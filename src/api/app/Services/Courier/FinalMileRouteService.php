<?php

namespace App\Services\Courier;

use App\Enums\FulfillmentTaskLeg;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class FinalMileRouteService
{
    public function __construct(private readonly FinalMileBatchService $batches) {}

    public function route(User $courier, string $id): array
    {
        $schedule = $this->batches->schedule($courier, $id);
        if ($schedule->shipments->isEmpty() || $schedule->shipments->contains(fn ($member) => $member->task?->leg !== FulfillmentTaskLeg::FinalMile)) {
            throw FulfillmentException::conflict('BATCH_STATE_CONFLICT', 'This schedule is not an active final-mile dispatch.');
        }
        if ($schedule->shipments->contains(fn ($member) => $member->task?->courier_id !== $courier->id
            || $member->shipment?->current_logistics_organization_id !== $schedule->logistics_organization_id
            || $member->shipment?->current_hub_id !== $schedule->logistics_hub_id)) {
            throw FulfillmentException::conflict('BATCH_STATE_CONFLICT', 'A parcel is no longer in this Courier dispatch.');
        }
        if ($schedule->shipments->contains(fn ($member) => $member->task?->accepted_at === null)) {
            throw FulfillmentException::conflict('BATCH_NOT_ACCEPTED', 'Accept the complete dispatch before loading its route.');
        }
        $schedule->loadMissing('shipments.shipment.parcel.order.address');
        $hub = $schedule->shipments->first()->shipment?->currentHub?->address;
        if (! $hub || ! $this->coordinate($hub)) {
            return $this->unavailable('missing_hub_coordinates');
        }
        $nodes = [[
            'kind' => 'hub', 'task_id' => null, 'label' => 'Logistics hub',
            'longitude' => (float) $hub->longitude, 'latitude' => (float) $hub->latitude,
        ]];
        $missingDestinationCoordinates = false;
        foreach ($schedule->shipments->sortBy('sequence') as $member) {
            $address = $member->shipment?->parcel?->order?->address;
            if (! $address || ! $this->coordinate($address)) {
                $missingDestinationCoordinates = true;

                continue;
            }
            $nodes[] = [
                'kind' => 'delivery', 'task_id' => $member->delivery_task_id,
                'label' => trim(implode(', ', array_filter([$address->barangay, $address->city_municipality, $address->province]))) ?: 'Delivery stop',
                'longitude' => (float) $address->longitude, 'latitude' => (float) $address->latitude,
            ];
        }
        if ($missingDestinationCoordinates) {
            return $this->unavailable('missing_destination_coordinates', $nodes);
        }
        if (count($nodes) > 16) {
            return $this->unavailable('node_limit_exceeded', $nodes);
        }
        $fingerprint = hash('sha256', json_encode(array_map(fn ($node) => [$node['task_id'], $node['longitude'], $node['latitude']], $nodes), JSON_THROW_ON_ERROR));

        $cacheKey = 'final-mile-route:'.$schedule->id.':'.$fingerprint;
        $cached = Cache::get($cacheKey);
        if (is_array($cached) && ($cached['status'] ?? null) === 'ready') {
            return $cached;
        }
        $result = $this->calculate($nodes);
        if ($result['status'] === 'ready') {
            Cache::put($cacheKey, $result, now()->addHours(24));
        }

        return $result;
    }

    private function calculate(array $nodes): array
    {
        $key = (string) config('services.geoapify.server_key');
        if ($key === '') {
            return $this->unavailable('provider_unconfigured', $nodes);
        }
        $credits = count($nodes) ** 2;
        if (! $this->reserve('matrix', $credits, (int) config('pickup_routes.daily_matrix_credit_limit', 2200))) {
            return $this->unavailable('quota_guard', $nodes);
        }
        $locations = array_map(fn ($node) => ['location' => [$node['longitude'], $node['latitude']]], $nodes);
        try {
            $response = Http::acceptJson()->timeout((int) config('services.geoapify.matrix_timeout', 4))
                ->post('https://api.geoapify.com/v1/routematrix?apiKey='.urlencode($key), ['mode' => 'drive', 'sources' => $locations, 'targets' => $locations]);
            $matrix = $response->successful() ? $response->json('sources_to_targets') : null;
            if (! is_array($matrix) || count($matrix) !== count($nodes)) {
                return $this->unavailable($response->status() === 429 ? 'provider_quota' : 'matrix_unavailable', $nodes);
            }
            $order = [0];
            $remaining = range(1, count($nodes) - 1);
            $distance = 0;
            $duration = 0;
            while ($remaining !== []) {
                $from = $order[array_key_last($order)];
                usort($remaining, fn ($a, $b) => [
                    $matrix[$from][$a]['time'] ?? PHP_INT_MAX, $matrix[$from][$a]['distance'] ?? PHP_INT_MAX, $a,
                ] <=> [
                    $matrix[$from][$b]['time'] ?? PHP_INT_MAX, $matrix[$from][$b]['distance'] ?? PHP_INT_MAX, $b,
                ]);
                $next = array_shift($remaining);
                $cell = $matrix[$from][$next] ?? null;
                if (! is_numeric($cell['time'] ?? null) || ! is_numeric($cell['distance'] ?? null)) {
                    return $this->unavailable('unreachable_stop', $nodes);
                }
                $distance += (int) $cell['distance'];
                $duration += (int) $cell['time'];
                $order[] = $next;
            }
            $stops = array_map(fn ($index) => $nodes[$index], $order);
            $coordinates = array_map(fn ($node) => [$node['longitude'], $node['latitude']], $stops);
            $source = 'stop_sequence_fallback';
            if (count($stops) > 1 && $this->reserve('routing', count($stops), (int) config('pickup_routes.daily_routing_credit_limit', 300))) {
                $waypoints = implode('|', array_map(fn ($node) => $node['latitude'].','.$node['longitude'], $stops));
                $routing = Http::acceptJson()->timeout((int) config('services.geoapify.routing_timeout', 8))
                    ->get('https://api.geoapify.com/v1/routing', ['waypoints' => $waypoints, 'mode' => 'drive', 'format' => 'geojson', 'apiKey' => $key]);
                $road = $routing->successful() ? $this->roadCoordinates($routing->json()) : null;
                if ($road !== null) {
                    $coordinates = $road;
                    $source = 'geoapify_routing';
                }
            }
            $features = [[
                'type' => 'Feature', 'geometry' => ['type' => 'LineString', 'coordinates' => $coordinates],
                'properties' => ['kind' => 'route_line', 'geometry_source' => $source],
            ]];
            foreach ($stops as $sequence => $stop) {
                $features[] = ['type' => 'Feature', 'geometry' => ['type' => 'Point', 'coordinates' => [$stop['longitude'], $stop['latitude']]], 'properties' => ['kind' => $stop['kind'], 'sequence' => $sequence]];
            }

            return [
                'status' => 'ready', 'reason' => null, 'summary' => ['stop_count' => count($stops) - 1, 'distance_metres' => $distance, 'duration_seconds' => $duration],
                'stops' => array_map(fn ($index, $stop) => ['sequence' => $index, ...$stop], array_keys($stops), $stops),
                'geojson' => ['type' => 'FeatureCollection', 'features' => $features],
                'map' => ['style_url' => '/api/v1/courier/map-style', 'attribution' => ['Geoapify', 'OpenStreetMap contributors', 'OpenMapTiles']],
            ];
        } catch (\Throwable) {
            return $this->unavailable('provider_failure', $nodes);
        }
    }

    private function roadCoordinates(mixed $payload): ?array
    {
        $geometry = $payload['features'][0]['geometry'] ?? null;
        $raw = match ($geometry['type'] ?? null) {
            'LineString' => $geometry['coordinates'] ?? null,
            'MultiLineString' => isset($geometry['coordinates']) ? array_merge(...$geometry['coordinates']) : null,
            default => null,
        };
        if (! is_array($raw) || count($raw) < 2 || count($raw) > 10000) {
            return null;
        }
        foreach ($raw as $pair) {
            if (! is_array($pair) || ! is_numeric($pair[0] ?? null) || ! is_numeric($pair[1] ?? null)) {
                return null;
            }
        }

        return array_map(fn ($pair) => [(float) $pair[0], (float) $pair[1]], $raw);
    }

    private function coordinate(object $address): bool
    {
        return is_numeric($address->latitude) && is_numeric($address->longitude)
            && abs((float) $address->latitude) <= 90 && abs((float) $address->longitude) <= 180;
    }

    private function reserve(string $type, int $credits, int $limit): bool
    {
        $name = 'geoapify:'.$type.'-credits:'.now('UTC')->format('Y-m-d');
        Cache::add($name, 0, now('UTC')->endOfDay());
        $used = (int) Cache::increment($name, $credits);
        if ($used <= $limit) {
            return true;
        }
        Cache::decrement($name, $credits);

        return false;
    }

    private function unavailable(string $reason, array $nodes = []): array
    {
        $features = [];
        if (count($nodes) > 1) {
            $features[] = [
                'type' => 'Feature',
                'geometry' => ['type' => 'LineString', 'coordinates' => array_map(fn ($node) => [$node['longitude'], $node['latitude']], $nodes)],
                'properties' => ['kind' => 'route_line', 'geometry_source' => 'stop_sequence_fallback'],
            ];
        }
        foreach ($nodes as $sequence => $node) {
            $features[] = ['type' => 'Feature', 'geometry' => ['type' => 'Point', 'coordinates' => [$node['longitude'], $node['latitude']]], 'properties' => ['kind' => $node['kind'], 'sequence' => $sequence]];
        }

        return [
            'status' => 'unavailable', 'reason' => $reason, 'summary' => null,
            'stops' => array_map(fn ($index, $node) => ['sequence' => $index, ...$node], array_keys($nodes), $nodes),
            'geojson' => $features === [] ? null : ['type' => 'FeatureCollection', 'features' => $features],
            'map' => $features === [] ? null : ['style_url' => '/api/v1/courier/map-style', 'attribution' => ['Geoapify', 'OpenStreetMap contributors', 'OpenMapTiles']],
        ];
    }
}
