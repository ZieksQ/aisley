<?php

namespace App\Services\Logistics\Routing;

use App\Models\Address;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class GeoapifyHubMetrics
{
    public function fingerprint(?Address $address): ?string
    {
        if ($address?->latitude === null || $address->longitude === null) {
            return null;
        }
        $lat = (float) $address->latitude;
        $lon = (float) $address->longitude;
        if (! is_finite($lat) || ! is_finite($lon) || abs($lat) > 90 || abs($lon) > 180) {
            return null;
        }

        return hash('sha256', sprintf('%.7f,%.7f', $lat, $lon));
    }

    /** Batch 1×N matrices by allowed source, never measure an unconfigured edge. */
    public function measure(Collection $connections): array
    {
        $result = [];
        $uncached = collect();
        $serverKey = config('services.geoapify.server_key');
        foreach ($connections as $edge) {
            $source = $this->fingerprint($edge->fromHub->address);
            $target = $this->fingerprint($edge->toHub->address);
            $result[$edge->id] = ['provider_status' => 'coordinates_missing'];
            if ($source === null || $target === null) {
                continue;
            }
            // Operator-recorded lane measurements are explicit road inputs, never geometric guesses.
            if ($edge->distance_meters > 0 && $edge->duration_seconds > 0) {
                $result[$edge->id] = [
                    'provider_status' => 'calculated', 'provider' => 'operator',
                    'distance_meters' => (float) $edge->distance_meters, 'duration_seconds' => (float) $edge->duration_seconds,
                    'source_fingerprint' => $source, 'destination_fingerprint' => $target,
                    'metric_calculated_at' => $edge->updated_at->toISOString(), 'provider_request_id' => (string) Str::uuid(),
                ];

                continue;
            }
            if (! $serverKey) {
                $result[$edge->id] = ['provider_status' => 'key_missing'];

                continue;
            }
            $cacheKey = 'hub-metric:'.$edge->from_hub_id.':'.$edge->to_hub_id.':'.$source.':'.$target.':drive:metric:free_flow:balanced';
            $cached = Cache::get($cacheKey);
            if (is_array($cached) && ($cached['provider_status'] ?? null) === 'calculated') {
                $result[$edge->id] = $cached;
                Log::info('hub_routing.metric_cache_hit');
            } else {
                $uncached->push(['edge' => $edge, 'cache_key' => $cacheKey, 'source_fingerprint' => $source, 'destination_fingerprint' => $target]);
            }
        }
        foreach ($uncached->groupBy(fn (array $entry) => $entry['edge']->from_hub_id) as $group) {
            $group = $group->values();
            $key = $serverKey;
            $status = 'key_missing';
            $response = null;
            $started = microtime(true);
            $requestId = (string) Str::uuid();
            $creditKey = 'geoapify:route-matrix-credits:'.now('UTC')->format('Y-m-d');
            if ($key) {
                Cache::add($creditKey, 0, now('UTC')->endOfDay());
                $used = (int) Cache::increment($creditKey, $group->count());
                if ($used > (int) config('pickup_routes.daily_matrix_credit_limit', 2200)) {
                    Cache::decrement($creditKey, $group->count());
                    foreach ($group as $entry) {
                        $result[$entry['edge']->id] = ['provider_status' => 'quota'];
                    }
                    Log::info('hub_routing.metric', ['status' => 'quota']);

                    continue;
                }
            }
            if ($key) {
                try {
                    $source = $group[0]['edge']->fromHub->address;
                    $response = Http::acceptJson()->timeout((int) config('services.geoapify.matrix_timeout', 4))
                        ->post('https://api.geoapify.com/v1/routematrix?apiKey='.urlencode($key), [
                            'mode' => 'drive', 'units' => 'metric', 'traffic' => 'free_flow', 'type' => 'balanced',
                            'sources' => [['location' => [(float) $source->longitude, (float) $source->latitude]]],
                            'targets' => $group->map(function (array $entry): array {
                                $address = $entry['edge']->toHub->address;

                                return ['location' => [(float) $address->longitude, (float) $address->latitude]];
                            })->all(),
                        ]);
                    $status = $response->status() === 429 ? 'quota' : ($response->successful() ? 'malformed' : 'provider_error');
                } catch (\Throwable) {
                    // Provider exceptions can contain the credential-bearing URL: never report them.
                    $status = 'timeout';
                }
            }
            foreach ($group as $index => $entry) {
                $metric = ['provider_status' => $status];
                $cell = $response?->successful() ? data_get($response->json(), "sources_to_targets.0.$index") : null;
                $distance = $cell['distance'] ?? null;
                $duration = $cell['time'] ?? null;
                if (is_numeric($distance) && is_numeric($duration) && is_finite((float) $distance) && is_finite((float) $duration) && $distance >= 0 && $duration >= 0) {
                    $metric = [
                        'provider_status' => 'calculated', 'provider' => 'geoapify',
                        'distance_meters' => (float) $distance, 'duration_seconds' => (float) $duration,
                        'source_fingerprint' => $entry['source_fingerprint'], 'destination_fingerprint' => $entry['destination_fingerprint'],
                        'metric_calculated_at' => now()->toISOString(), 'provider_request_id' => $requestId,
                    ];
                    Cache::put($entry['cache_key'], $metric, (int) config('hub-routing.metric_cache_seconds'));
                } elseif ($response?->successful() && $cell === null) {
                    $metric['provider_status'] = 'route_unavailable';
                }
                $result[$entry['edge']->id] = $metric;
                Log::info('hub_routing.metric', ['status' => $metric['provider_status'], 'request_id' => $requestId, 'latency_ms' => (int) ((microtime(true) - $started) * 1000)]);
            }
        }

        return $result;
    }
}
