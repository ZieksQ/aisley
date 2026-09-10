<?php

namespace App\Services\Logistics;

use App\Enums\PickupRouteManifestStatus;
use App\Enums\PickupScheduleStatus;
use App\Models\AddressCoordinateDefault;
use App\Models\PickupRouteManifest;
use App\Models\PickupSchedule;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class BuildPickupRouteManifest
{
    public function handle(string $scheduleId, int $revision): PickupRouteManifest
    {
        $schedule = PickupSchedule::query()
            ->whereKey($scheduleId)
            ->with(['hub.address', 'tasks.waybill.snapshot', 'tasks.order:id,reference'])
            ->firstOrFail();
        $manifest = PickupRouteManifest::query()->firstOrCreate(
            ['pickup_schedule_id' => $schedule->id, 'schedule_revision' => $revision],
            ['status' => PickupRouteManifestStatus::Pending],
        );

        if ($schedule->revision !== $revision || $schedule->status !== PickupScheduleStatus::Scheduled) {
            return $this->unavailable($manifest, 'schedule_unavailable');
        }

        $nodes = $this->nodes($schedule);
        if ($nodes['reason'] !== null) {
            return $this->unavailable($manifest, $nodes['reason']);
        }

        /** @var array<int, array<string, mixed>> $resolved */
        $resolved = $nodes['nodes'];
        $nodeCount = count($resolved);
        $maxNodes = (int) config('pickup_routes.max_nodes', 31);
        if ($nodeCount > $maxNodes) {
            return $this->unavailable($manifest, 'node_limit_exceeded');
        }

        $fingerprint = hash('sha256', json_encode(array_map(
            fn (array $node): array => [$node['id'], $node['latitude'], $node['longitude'], $node['coordinate_source']],
            $resolved,
        ), JSON_THROW_ON_ERROR));
        if ($manifest->status === PickupRouteManifestStatus::Ready && $manifest->coordinate_fingerprint === $fingerprint) {
            return $manifest;
        }

        $estimatedCredits = $nodeCount * min($nodeCount, 10);
        $manifest->update([
            'status' => PickupRouteManifestStatus::Pending,
            'coordinate_source' => $this->overallCoordinateSource($resolved),
            'coordinate_fingerprint' => $fingerprint,
            'estimated_credits' => $estimatedCredits,
            'failure_reason' => null,
        ]);

        $key = (string) config('services.geoapify.server_key');
        if ($key === '') {
            return $this->unavailable($manifest, 'provider_unconfigured');
        }
        if (! $this->reserveCredits($estimatedCredits)) {
            return $this->unavailable($manifest, 'quota_guard');
        }

        $locations = array_map(fn (array $node): array => [
            'location' => [(float) $node['longitude'], (float) $node['latitude']],
        ], $resolved);

        try {
            $response = Http::acceptJson()
                ->timeout((int) config('services.geoapify.matrix_timeout', 4))
                ->retry(1, 100, throw: false)
                ->post('https://api.geoapify.com/v1/routematrix?apiKey='.urlencode($key), [
                    'mode' => 'drive',
                    'sources' => $locations,
                    'targets' => $locations,
                ]);
            if (! $response->successful()) {
                Log::warning('Courier pickup route matrix provider failure.', [
                    'schedule_id' => $schedule->id,
                    'revision' => $revision,
                    'provider_status' => $response->status(),
                    'estimated_credits' => $estimatedCredits,
                ]);

                return $this->unavailable($manifest, $response->status() === 429 ? 'provider_quota' : 'provider_failure');
            }

            $matrix = $response->json('sources_to_targets');
            if (! $this->validMatrix($matrix, $nodeCount)) {
                return $this->unavailable($manifest, 'malformed_matrix');
            }

            $route = $this->orderStops($resolved, $matrix);
            $geojson = $this->geojson($route['stops'], $key, $schedule->id, $revision);
            $now = now();
            $manifest->update([
                'status' => PickupRouteManifestStatus::Ready,
                'total_distance_metres' => $route['distance'],
                'total_duration_seconds' => $route['duration'],
                'stops' => $route['stops'],
                'geojson' => $geojson,
                'failure_reason' => null,
                'calculated_at' => $now,
            ]);
            Log::info('Courier pickup route matrix calculated.', [
                'schedule_id' => $schedule->id,
                'revision' => $revision,
                'provider_status' => 200,
                'estimated_credits' => $estimatedCredits,
                'node_count' => $nodeCount,
            ]);

            return $manifest->fresh();
        } catch (\Throwable $exception) {
            report($exception);

            return $this->unavailable($manifest, 'provider_timeout');
        }
    }

    /** @return array{nodes: array<int, array<string, mixed>>, reason: string|null} */
    private function nodes(PickupSchedule $schedule): array
    {
        $hubAddress = $schedule->hub?->address;
        $hub = $hubAddress ? $this->coordinates([
            'country' => $hubAddress->country,
            'region' => $hubAddress->region,
            'province' => $hubAddress->province,
            'city_municipality' => $hubAddress->city_municipality,
            'barangay' => $hubAddress->barangay,
            'latitude' => $hubAddress->latitude,
            'longitude' => $hubAddress->longitude,
        ]) : null;
        if ($hub === null) {
            return ['nodes' => [], 'reason' => 'missing_hub_coordinates'];
        }

        $nodes = [[
            'id' => 'hub-'.$schedule->logistics_hub_id,
            'kind' => 'hub',
            'latitude' => $hub['latitude'],
            'longitude' => $hub['longitude'],
            'coordinate_source' => $hub['source'],
            'address_summary' => $this->summary($hubAddress->barangay, $hubAddress->city_municipality, $hubAddress->province),
            'task_position' => -1,
            'tasks' => [],
        ]];
        $grouped = [];
        $tasks = $schedule->tasks->sortBy(fn ($task) => $task->created_at?->format('U.u').'|'.$task->id)->values();
        foreach ($tasks as $position => $task) {
            $pickup = $task->waybill?->snapshot?->payload['pickup'] ?? null;
            if (! is_array($pickup)) {
                return ['nodes' => [], 'reason' => 'missing_pickup_coordinates'];
            }
            $coordinate = $this->coordinates($pickup);
            if ($coordinate === null) {
                return ['nodes' => [], 'reason' => 'missing_pickup_coordinates'];
            }
            $groupKey = hash('sha256', implode('|', [
                $this->normalize($pickup['country'] ?? ''),
                $this->normalize($pickup['region'] ?? ''),
                $this->normalize($pickup['province'] ?? ''),
                $this->normalize($pickup['city_municipality'] ?? ''),
                $this->normalize($pickup['barangay'] ?? ''),
                number_format($coordinate['latitude'], 7, '.', ''),
                number_format($coordinate['longitude'], 7, '.', ''),
            ]));
            if (! isset($grouped[$groupKey])) {
                $grouped[$groupKey] = [
                    'id' => 'pickup-'.substr($groupKey, 0, 20),
                    'kind' => 'pickup',
                    'latitude' => $coordinate['latitude'],
                    'longitude' => $coordinate['longitude'],
                    'coordinate_source' => $coordinate['source'],
                    'address_summary' => $this->summary($pickup['barangay'] ?? null, $pickup['city_municipality'] ?? null, $pickup['province'] ?? null),
                    'task_position' => $position,
                    'tasks' => [],
                ];
            }
            $grouped[$groupKey]['tasks'][] = [
                'task_id' => $task->id,
                'order_id' => $task->order_id,
                'order_reference' => $task->order?->reference,
                'waybill_reference' => $task->waybill?->reference,
            ];
        }

        return ['nodes' => [...$nodes, ...array_values($grouped)], 'reason' => null];
    }

    /** @return array{latitude: float, longitude: float, source: string}|null */
    private function coordinates(array $address): ?array
    {
        if ($this->validCoordinatePair($address['latitude'] ?? null, $address['longitude'] ?? null)) {
            return ['latitude' => (float) $address['latitude'], 'longitude' => (float) $address['longitude'], 'source' => 'exact'];
        }
        $default = AddressCoordinateDefault::query()
            ->where('is_active', true)
            ->whereRaw('LOWER(country) = ?', [$this->normalize($address['country'] ?? '')])
            ->whereRaw('LOWER(region) = ?', [$this->normalize($address['region'] ?? '')])
            ->whereRaw('LOWER(province) = ?', [$this->normalize($address['province'] ?? '')])
            ->whereRaw('LOWER(city_municipality) = ?', [$this->normalize($address['city_municipality'] ?? '')])
            ->whereRaw('LOWER(barangay) = ?', [$this->normalize($address['barangay'] ?? '')])
            ->first();

        return $default ? ['latitude' => (float) $default->latitude, 'longitude' => (float) $default->longitude, 'source' => 'address_default'] : null;
    }

    private function validCoordinatePair(mixed $latitude, mixed $longitude): bool
    {
        return is_numeric($latitude) && is_numeric($longitude)
            && (float) $latitude >= -90 && (float) $latitude <= 90
            && (float) $longitude >= -180 && (float) $longitude <= 180
            && ! ((float) $latitude === 0.0 && (float) $longitude === 0.0);
    }

    private function normalize(mixed $value): string
    {
        return Str::lower(trim((string) $value));
    }

    private function summary(?string $barangay, ?string $city, ?string $province): string
    {
        return collect([$barangay, $city, $province])->filter()->implode(', ');
    }

    /** @param array<int, array<string, mixed>> $nodes */
    private function overallCoordinateSource(array $nodes): string
    {
        $sources = collect($nodes)->pluck('coordinate_source')->unique();

        return $sources->count() === 1 ? (string) $sources->first() : 'mixed';
    }

    private function reserveCredits(int $credits): bool
    {
        $cacheKey = 'geoapify:route-matrix-credits:'.now('UTC')->format('Y-m-d');
        Cache::add($cacheKey, 0, now('UTC')->endOfDay());
        $used = (int) Cache::increment($cacheKey, $credits);
        if ($used <= (int) config('pickup_routes.daily_matrix_credit_limit', 2200)) {
            return true;
        }
        Cache::decrement($cacheKey, $credits);

        return false;
    }

    private function validMatrix(mixed $matrix, int $size): bool
    {
        if (! is_array($matrix) || count($matrix) !== $size) {
            return false;
        }
        foreach ($matrix as $row) {
            if (! is_array($row) || count($row) !== $size) {
                return false;
            }
        }

        return true;
    }

    /** @param array<int, array<string, mixed>> $nodes @param array<int, array<int, array<string, mixed>>> $matrix */
    private function orderStops(array $nodes, array $matrix): array
    {
        $unvisited = array_keys(array_slice($nodes, 1, null, true));
        $ordered = [$this->stop($nodes[0], 0, null, null, true)];
        $current = 0;
        $distance = 0;
        $duration = 0;

        while ($unvisited !== []) {
            $candidates = [];
            foreach ($unvisited as $index) {
                $leg = $matrix[$current][$index] ?? null;
                if (is_numeric($leg['time'] ?? null) && is_numeric($leg['distance'] ?? null)) {
                    $candidates[] = ['index' => $index, 'time' => (int) $leg['time'], 'distance' => (int) $leg['distance'], 'position' => $nodes[$index]['task_position']];
                }
            }
            usort($candidates, fn (array $a, array $b): int => [$a['time'], $a['distance'], $a['position'], $a['index']] <=> [$b['time'], $b['distance'], $b['position'], $b['index']]);
            if ($candidates === []) {
                foreach ($unvisited as $index) {
                    $ordered[] = $this->stop($nodes[$index], count($ordered), null, null, false);
                }
                $unvisited = [];
                break;
            }
            $next = $candidates[0];
            $distance += $next['distance'];
            $duration += $next['time'];
            $ordered[] = $this->stop($nodes[$next['index']], count($ordered), $next['distance'], $next['time'], true);
            $current = $next['index'];
            $unvisited = array_values(array_diff($unvisited, [$current]));
        }

        $home = $matrix[$current][0] ?? null;
        $homeReachable = is_numeric($home['time'] ?? null) && is_numeric($home['distance'] ?? null);
        if ($homeReachable) {
            $distance += (int) $home['distance'];
            $duration += (int) $home['time'];
        }
        $ordered[] = $this->stop($nodes[0], count($ordered), $homeReachable ? (int) $home['distance'] : null, $homeReachable ? (int) $home['time'] : null, $homeReachable);

        return ['stops' => $ordered, 'distance' => $distance, 'duration' => $duration];
    }

    private function stop(array $node, int $sequence, ?int $distance, ?int $duration, bool $reachable): array
    {
        return [
            'sequence' => $sequence,
            'node_id' => $node['id'],
            'kind' => $node['kind'],
            'address_summary' => $node['address_summary'],
            'latitude' => $node['latitude'],
            'longitude' => $node['longitude'],
            'coordinate_source' => $node['coordinate_source'],
            'leg_distance_metres' => $distance,
            'leg_duration_seconds' => $duration,
            'reachable' => $reachable,
            'tasks' => $node['tasks'],
        ];
    }

    /** @param array<int, array<string, mixed>> $stops */
    private function geojson(array $stops, string $key, string $scheduleId, int $revision): array
    {
        $reachable = array_values(array_filter($stops, fn (array $stop): bool => $stop['reachable']));
        $roadCoordinates = $this->roadCoordinates($reachable, $key, $scheduleId, $revision);
        $features = [[
            'type' => 'Feature',
            'geometry' => [
                'type' => 'LineString',
                'coordinates' => $roadCoordinates ?? array_map(fn (array $stop): array => [$stop['longitude'], $stop['latitude']], $reachable),
            ],
            'properties' => [
                'kind' => 'route_line',
                'geometry_source' => $roadCoordinates === null ? 'stop_sequence_fallback' : 'geoapify_routing',
            ],
        ]];
        foreach ($stops as $stop) {
            $features[] = [
                'type' => 'Feature',
                'geometry' => ['type' => 'Point', 'coordinates' => [$stop['longitude'], $stop['latitude']]],
                'properties' => ['node_id' => $stop['node_id'], 'sequence' => $stop['sequence'], 'kind' => $stop['kind'], 'reachable' => $stop['reachable']],
            ];
        }

        return ['type' => 'FeatureCollection', 'features' => $features];
    }

    /** @param array<int, array<string, mixed>> $stops @return array<int, array{0: float, 1: float}>|null */
    private function roadCoordinates(array $stops, string $key, string $scheduleId, int $revision): ?array
    {
        if (count($stops) < 2) {
            return null;
        }

        $maxWaypoints = (int) config('pickup_routes.routing_max_waypoints', 25);
        $chunks = [];
        for ($offset = 0; $offset < count($stops) - 1; $offset += $maxWaypoints - 1) {
            $chunks[] = array_slice($stops, $offset, $maxWaypoints);
        }
        $estimatedCredits = array_sum(array_map('count', $chunks));
        if (! $this->reserveRoutingCredits($estimatedCredits)) {
            Log::warning('Courier pickup road geometry skipped by quota guard.', [
                'schedule_id' => $scheduleId,
                'revision' => $revision,
                'estimated_credits' => $estimatedCredits,
            ]);

            return null;
        }

        $coordinates = [];
        try {
            foreach ($chunks as $chunk) {
                $waypoints = implode('|', array_map(
                    fn (array $stop): string => $stop['latitude'].','.$stop['longitude'],
                    $chunk,
                ));
                $response = Http::acceptJson()
                    ->timeout((int) config('services.geoapify.routing_timeout', 8))
                    ->retry(1, 100, throw: false)
                    ->get('https://api.geoapify.com/v1/routing', [
                        'waypoints' => $waypoints,
                        'mode' => 'drive',
                        'format' => 'geojson',
                        'apiKey' => $key,
                    ]);
                $chunkCoordinates = $response->successful() ? $this->routingCoordinates($response->json()) : null;
                if ($chunkCoordinates === null) {
                    Log::warning('Courier pickup road geometry provider failure.', [
                        'schedule_id' => $scheduleId,
                        'revision' => $revision,
                        'provider_status' => $response->status(),
                    ]);

                    return null;
                }
                if ($coordinates !== [] && $coordinates[array_key_last($coordinates)] === $chunkCoordinates[0]) {
                    array_shift($chunkCoordinates);
                }
                array_push($coordinates, ...$chunkCoordinates);
            }
        } catch (\Throwable $exception) {
            report($exception);

            return null;
        }

        return count($coordinates) >= 2 ? $coordinates : null;
    }

    /** @return array<int, array{0: float, 1: float}>|null */
    private function routingCoordinates(mixed $payload): ?array
    {
        $geometry = is_array($payload) ? ($payload['features'][0]['geometry'] ?? null) : null;
        if (! is_array($geometry) || ! is_array($geometry['coordinates'] ?? null)) {
            return null;
        }
        $raw = match ($geometry['type'] ?? null) {
            'LineString' => $geometry['coordinates'],
            'MultiLineString' => array_merge(...$geometry['coordinates']),
            default => null,
        };
        if (! is_array($raw)) {
            return null;
        }
        $coordinates = [];
        foreach ($raw as $coordinate) {
            if (! is_array($coordinate) || ! is_numeric($coordinate[0] ?? null) || ! is_numeric($coordinate[1] ?? null)) {
                return null;
            }
            $coordinates[] = [(float) $coordinate[0], (float) $coordinate[1]];
        }

        return count($coordinates) >= 2 ? $coordinates : null;
    }

    private function reserveRoutingCredits(int $credits): bool
    {
        $cacheKey = 'geoapify:routing-credits:'.now('UTC')->format('Y-m-d');
        Cache::add($cacheKey, 0, now('UTC')->endOfDay());
        $used = (int) Cache::increment($cacheKey, $credits);
        if ($used <= (int) config('pickup_routes.daily_routing_credit_limit', 300)) {
            return true;
        }
        Cache::decrement($cacheKey, $credits);

        return false;
    }

    private function unavailable(PickupRouteManifest $manifest, string $reason): PickupRouteManifest
    {
        $manifest->update([
            'status' => PickupRouteManifestStatus::Unavailable,
            'total_distance_metres' => null,
            'total_duration_seconds' => null,
            'stops' => null,
            'geojson' => null,
            'failure_reason' => $reason,
            'calculated_at' => now(),
        ]);

        return $manifest->fresh();
    }
}
