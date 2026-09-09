<?php

namespace App\Services\Logistics;

use App\Models\Address;
use App\Models\LogisticsHub;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class LogisticsDistanceService
{
    /** @param iterable<LogisticsHub> $hubs @return array<string, array{distance_km: float|null,status: string,calculated_at: string|null,source_fingerprint: string|null,destination_fingerprint: string|null}> */
    public function distances(Address $source, iterable $hubs): array
    {
        $result = [];
        $allHubs = collect($hubs);
        $targets = $allHubs->filter(fn (LogisticsHub $hub) => $this->hasCoordinates($hub->address))->values();
        foreach ($allHubs as $hub) {
            $result[$hub->id] = $this->unavailable($source, $hub->address);
        }

        $key = config('services.geoapify.server_key');
        if (! $key || ! $this->hasCoordinates($source) || $targets->isEmpty()) {
            return $result;
        }

        $sourceFingerprint = $this->fingerprint($source);
        $uncached = collect();
        foreach ($targets as $hub) {
            $cacheKey = $this->cacheKey($source, $hub->address);
            $cached = Cache::get($cacheKey);
            if (is_array($cached)) {
                $result[$hub->id] = $cached;
            } else {
                $uncached->push($hub);
            }
        }
        if ($uncached->isEmpty()) {
            return $result;
        }

        try {
            $response = Http::acceptJson()->timeout((int) config('services.geoapify.matrix_timeout', 4))
                ->retry(1, 100, throw: false)
                ->post('https://api.geoapify.com/v1/routematrix?apiKey='.urlencode($key), [
                    'mode' => 'drive',
                    'sources' => [['location' => [(float) $source->longitude, (float) $source->latitude]]],
                    'targets' => $uncached->map(fn (LogisticsHub $hub) => ['location' => [(float) $hub->address->longitude, (float) $hub->address->latitude]])->all(),
                ]);
            if (! $response->successful()) {
                return $result;
            }
            foreach ($uncached as $index => $hub) {
                $meters = data_get($response->json(), "sources_to_targets.0.$index.distance");
                if (! is_numeric($meters) || $meters < 0) {
                    continue;
                }
                $value = [
                    'distance_km' => round(((float) $meters) / 1000, 3),
                    'status' => 'calculated',
                    'calculated_at' => now()->toISOString(),
                    'source_fingerprint' => $sourceFingerprint,
                    'destination_fingerprint' => $this->fingerprint($hub->address),
                ];
                $result[$hub->id] = $value;
                Cache::put($this->cacheKey($source, $hub->address), $value, now()->addHours(24));
            }
        } catch (\Throwable $exception) {
            report($exception);
        }

        return $result;
    }

    private function hasCoordinates(?Address $address): bool
    {
        return $address?->latitude !== null && $address->longitude !== null;
    }

    private function fingerprint(?Address $address): ?string
    {
        return $this->hasCoordinates($address) ? hash('sha256', number_format((float) $address->latitude, 7, '.', '').','.number_format((float) $address->longitude, 7, '.', '')) : null;
    }

    private function cacheKey(Address $source, Address $target): string
    {
        return 'logistics-distance:'.$this->fingerprint($source).':'.$this->fingerprint($target);
    }

    private function unavailable(Address $source, ?Address $target): array
    {
        return ['distance_km' => null, 'status' => 'unavailable', 'calculated_at' => null, 'source_fingerprint' => $this->fingerprint($source), 'destination_fingerprint' => $this->fingerprint($target)];
    }
}
