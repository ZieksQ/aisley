<?php

namespace App\Services\Seller;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class PsgcAddressService
{
    /**
     * @param  array<string, string>  $filters
     * @return list<array{code: string, name: string}>
     */
    public function options(string $level, array $filters = []): array
    {
        $token = trim((string) config('services.psgc.token'));

        if ($token === '') {
            throw new RuntimeException('PSGC address lookup is not configured.');
        }

        ksort($filters);
        $cacheKey = 'psgc:'.config('services.psgc.version').':'.$level.':'.hash('sha256', json_encode($filters));

        return Cache::remember($cacheKey, (int) config('services.psgc.cache_ttl', 86400), function () use ($filters, $level, $token): array {
            $baseUrl = rtrim((string) config('services.psgc.base_url'), '/');
            $version = trim((string) config('services.psgc.version'), '/');
            $response = Http::acceptJson()
                ->connectTimeout(5)
                ->timeout(15)
                ->retry(2, 250, throw: false)
                ->get("{$baseUrl}/{$version}/{$level}", [
                    ...$filters,
                    'page' => 1,
                    'page_size' => 1000,
                    'token' => $token,
                ]);

            if (! $response->successful()) {
                throw new RuntimeException('PSGC address lookup is temporarily unavailable.');
            }

            $rows = $response->json('results.psgc_data');

            if (! is_array($rows)) {
                throw new RuntimeException('PSGC returned an unexpected response.');
            }

            $codeField = match ($level) {
                'regions' => 'reg',
                'provinces' => 'prv',
                'municipalities' => 'mun',
                'barangays' => 'bgy',
                default => throw new RuntimeException('Unsupported PSGC address level.'),
            };

            return collect($rows)
                ->filter(fn ($row): bool => is_array($row)
                    && isset($row[$codeField], $row['area_name'])
                    && trim((string) $row['area_name']) !== '')
                ->map(fn (array $row): array => [
                    'code' => (string) $row[$codeField],
                    'name' => trim((string) $row['area_name']),
                ])
                ->unique('code')
                ->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)
                ->values()
                ->all();
        });
    }
}
