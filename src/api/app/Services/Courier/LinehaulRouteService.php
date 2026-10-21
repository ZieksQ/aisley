<?php

namespace App\Services\Courier;

use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\LinehaulTrip;
use App\Models\LogisticsHub;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class LinehaulRouteService
{
    public function route(User $courier, string $id): array
    {
        $trip = LinehaulTrip::query()->whereKey($id)->where('driver_id', $courier->id)
            ->with(['fromHub.address', 'toHub.address'])->first();
        if ($trip === null) {
            throw FulfillmentException::notFound('LINEHAUL_TRIP_NOT_FOUND', 'The assigned linehaul trip is unavailable.');
        }
        $hubs = [$this->hub($trip->fromHub, 'origin'), $this->hub($trip->toHub, 'destination')];
        if (collect($hubs)->contains(fn ($hub) => $hub['latitude'] === null)) {
            return $this->result($hubs, 'missing_hub_coordinates');
        }

        $fingerprint = hash('sha256', json_encode(array_map(fn ($hub) => [$hub['longitude'], $hub['latitude']], $hubs), JSON_THROW_ON_ERROR));
        $cacheKey = 'linehaul-route:v1:'.$trip->id.':'.$fingerprint;
        $calculation = Cache::get($cacheKey);
        if (! is_array($calculation)) {
            $calculation = $this->calculate($hubs);
            Cache::put($cacheKey, $calculation, $calculation['reason'] === null ? now()->addHours(24) : now()->addMinute());
        }

        return $this->result($hubs, $calculation['reason'], $calculation['summary'], $calculation['geometry']);
    }

    private function hub(?LogisticsHub $hub, string $kind): array
    {
        $address = $hub?->address;
        $latitude = $address?->latitude;
        $longitude = $address?->longitude;
        $valid = $this->number($latitude, 90) && $this->number($longitude, 180);

        return [
            'kind' => $kind,
            'name' => $hub?->name ?? 'Unknown hub',
            'address' => implode(', ', array_filter([
                $address?->address_line_1, $address?->address_line_2, $address?->barangay,
                $address?->city_municipality, $address?->province, $address?->region, $address?->postal_code,
            ])),
            'latitude' => $valid ? (float) $latitude : null,
            'longitude' => $valid ? (float) $longitude : null,
        ];
    }

    private function calculate(array $hubs): array
    {
        $key = (string) config('services.geoapify.server_key');
        if ($key === '') {
            return $this->calculation('provider_unconfigured');
        }
        $creditKey = 'geoapify:routing-credits:'.now('UTC')->format('Y-m-d');
        Cache::add($creditKey, 0, now('UTC')->endOfDay());
        if ((int) Cache::increment($creditKey, 2) > (int) config('pickup_routes.daily_routing_credit_limit', 300)) {
            Cache::decrement($creditKey, 2);

            return $this->calculation('quota_guard');
        }
        try {
            $response = Http::acceptJson()->timeout((int) config('services.geoapify.routing_timeout', 8))
                ->get('https://api.geoapify.com/v1/routing', [
                    'waypoints' => implode('|', array_map(fn ($hub) => $hub['latitude'].','.$hub['longitude'], $hubs)),
                    'mode' => 'drive', 'format' => 'geojson', 'apiKey' => $key,
                ]);
            if (! $response->successful()) {
                return $this->calculation($response->status() === 429 ? 'provider_quota' : 'route_unavailable');
            }
            $feature = $response->json('features.0');
            $coordinates = $this->coordinates($feature['geometry'] ?? null);
            $distance = $feature['properties']['distance'] ?? null;
            $duration = $feature['properties']['time'] ?? null;
            if ($coordinates === null || ! $this->metric($distance) || ! $this->metric($duration)) {
                return $this->calculation('route_unavailable');
            }

            return [
                'reason' => null,
                'summary' => ['distance_metres' => (float) $distance, 'duration_seconds' => (float) $duration],
                'geometry' => ['type' => 'LineString', 'coordinates' => $coordinates],
            ];
        } catch (\Throwable) {
            return $this->calculation('provider_failure');
        }
    }

    private function coordinates(mixed $geometry): ?array
    {
        if (! is_array($geometry)) {
            return null;
        }
        $raw = $geometry['coordinates'] ?? null;
        if (($geometry['type'] ?? null) === 'MultiLineString') {
            if (! is_array($raw) || $raw === [] || count($raw) > 100 || collect($raw)->contains(fn ($line) => ! is_array($line) || count($line) < 2)) {
                return null;
            }
            $raw = array_merge(...$raw);
        } elseif (($geometry['type'] ?? null) !== 'LineString') {
            return null;
        }
        if (! is_array($raw) || count($raw) < 2 || count($raw) > 10000) {
            return null;
        }
        foreach ($raw as $point) {
            if (! is_array($point) || ! $this->number($point[0] ?? null, 180) || ! $this->number($point[1] ?? null, 90)) {
                return null;
            }
        }

        return array_map(fn ($point) => [(float) $point[0], (float) $point[1]], $raw);
    }

    private function number(mixed $value, int $limit): bool
    {
        return is_numeric($value) && is_finite((float) $value) && abs((float) $value) <= $limit;
    }

    private function metric(mixed $value): bool
    {
        return is_numeric($value) && is_finite((float) $value) && (float) $value >= 0;
    }

    private function calculation(string $reason): array
    {
        return ['reason' => $reason, 'summary' => null, 'geometry' => null];
    }

    private function result(array $hubs, ?string $reason, ?array $summary = null, ?array $geometry = null): array
    {
        return ['status' => $reason === null ? 'ready' : 'unavailable', 'reason' => $reason, 'hubs' => $hubs, 'summary' => $summary, 'geometry' => $geometry];
    }
}
