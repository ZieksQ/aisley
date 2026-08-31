<?php

namespace App\Services\Seller;

use Illuminate\Support\Facades\Cache;
use RuntimeException;

class RegistrationAddressService
{
    /**
     * @param  array<string, string>  $filters
     * @return list<array{code: string, name: string}>
     */
    public function options(string $level, array $filters = []): array
    {
        return match ($level) {
            'regions' => $this->regionOptions(),
            'provinces' => $this->childOptions($this->region($filters['reg'] ?? ''), ['province']),
            'municipalities' => $this->municipalityOptions($filters),
            'barangays' => $this->barangayOptions($filters),
            default => throw new RuntimeException('Unsupported address level.'),
        };
    }

    /** @return list<array{code: string, name: string}> */
    private function regionOptions(): array
    {
        return $this->toOptions($this->index(), 'psgc_code');
    }

    /** @return list<array{code: string, name: string}> */
    private function municipalityOptions(array $filters): array
    {
        $region = $this->region($filters['reg'] ?? '');
        $parent = $region;

        if (! empty($filters['prv'])) {
            $parent = $this->findDirectChild($region, $filters['prv'], ['province']);
        }

        return $this->childOptions($parent, ['city', 'municipality']);
    }

    /** @return list<array{code: string, name: string}> */
    private function barangayOptions(array $filters): array
    {
        $region = $this->region($filters['reg'] ?? '');
        $parent = $region;

        if (! empty($filters['prv'])) {
            $parent = $this->findDirectChild($region, $filters['prv'], ['province']);
        }

        $municipality = $this->findDirectChild($parent, $filters['mun'] ?? '', ['city', 'municipality']);

        return $this->descendantOptions($municipality, 'barangay');
    }

    /** @return array<string, mixed> */
    private function region(string $code): array
    {
        $entry = collect($this->index())->first(fn($item): bool => is_array($item)
            && (string) ($item['psgc_code'] ?? '') === $code);

        if (! is_array($entry) || ! isset($entry['file']) || ! is_string($entry['file'])) {
            throw new RuntimeException('The requested region is unavailable.');
        }

        $path = $this->safePath($entry['file']);
        $payload = $this->readJson($path);
        $region = $payload['region'] ?? null;

        if (! is_array($region) || (string) ($region['psgc_code'] ?? '') !== $code) {
            throw new RuntimeException('The requested region data is invalid.');
        }

        return $region;
    }

    /** @return list<array<string, mixed>> */
    private function index(): array
    {
        $payload = $this->readJson($this->basePath() . '/list-of-all-regions.json');

        if (! array_is_list($payload)) {
            throw new RuntimeException('The address region index is invalid.');
        }

        return $payload;
    }

    /** @return array<string, mixed> */
    private function findDirectChild(array $parent, string $code, array $levels): array
    {
        $child = collect($parent['children'] ?? [])->first(fn($item): bool => is_array($item)
            && (string) ($item['psgc_code'] ?? '') === $code
            && in_array($item['geographic_level'] ?? null, $levels, true));

        if (! is_array($child)) {
            throw new RuntimeException('The requested address option is unavailable.');
        }

        return $child;
    }

    /** @return list<array{code: string, name: string}> */
    private function childOptions(array $parent, array $levels): array
    {
        return $this->toOptions(array_values(array_filter(
            $parent['children'] ?? [],
            fn($item): bool => is_array($item) && in_array($item['geographic_level'] ?? null, $levels, true),
        )));
    }

    /** @return list<array{code: string, name: string}> */
    private function descendantOptions(array $parent, string $level): array
    {
        $matches = [];
        $visit = function (array $node) use (&$visit, &$matches, $level): void {
            foreach ($node['children'] ?? [] as $child) {
                if (! is_array($child)) {
                    continue;
                }
                if (($child['geographic_level'] ?? null) === $level) {
                    $matches[] = $child;
                } else {
                    $visit($child);
                }
            }
        };
        $visit($parent);

        return $this->toOptions($matches);
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @return list<array{code: string, name: string}>
     */
    private function toOptions(array $items, string $codeField = 'psgc_code'): array
    {
        return collect($items)
            ->filter(fn($item): bool => is_array($item)
                && trim((string) ($item[$codeField] ?? '')) !== ''
                && trim((string) ($item['name'] ?? '')) !== '')
            ->map(fn(array $item): array => [
                'code' => trim((string) $item[$codeField]),
                'name' => trim((string) $item['name']),
            ])
            ->unique('code')
            ->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)
            ->values()
            ->all();
    }

    /** @return array<mixed> */
    private function readJson(string $path): array
    {
        if (! is_file($path) || ! is_readable($path)) {
            throw new RuntimeException('Address data is unavailable.');
        }

        $cacheKey = 'registration-addresses:' . hash('sha256', $path . ':' . filemtime($path));

        return Cache::remember($cacheKey, 86400, function () use ($path): array {
            $contents = file_get_contents($path);
            $decoded = is_string($contents) ? json_decode($contents, true) : null;

            if (! is_array($decoded)) {
                throw new RuntimeException('Address data is invalid.');
            }

            return $decoded;
        });
    }

    private function safePath(string $relativePath): string
    {
        $base = realpath($this->basePath());
        $path = realpath($this->basePath() . '/' . $relativePath);

        if ($base === false || $path === false || ! str_starts_with($path, $base . DIRECTORY_SEPARATOR)) {
            throw new RuntimeException('Address data path is invalid.');
        }

        return $path;
    }

    private function basePath(): string
    {
        return rtrim((string) config('seller.registration.addresses_path', base_path('addresses')), '/');
    }
}
