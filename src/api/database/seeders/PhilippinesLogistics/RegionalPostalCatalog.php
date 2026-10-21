<?php

namespace Database\Seeders\PhilippinesLogistics;

use Illuminate\Support\Str;

/** Offline researched postal snapshot; provenance and region corrections live beside the CSV. */
class RegionalPostalCatalog
{
    private static ?array $regions = null;

    /** @return array<string, array{postal_code: string, name: string, code: string}> */
    public static function forRegion(string $region): array
    {
        if (self::$regions === null) {
            $rows = [];
            $file = fopen(__DIR__.'/data/postal-codes.csv', 'r');
            fgetcsv($file, escape: '');
            while (($row = fgetcsv($file, escape: '')) !== false) {
                [$slug, , $locality, $postal] = $row;
                $rows[$slug][$postal][] = $locality;
            }
            fclose($file);

            self::$regions = [];
            foreach ($rows as $slug => $codes) {
                foreach ($codes as $postal => $localities) {
                    $postal = (string) $postal;
                    $localities = array_values(array_unique($localities));
                    $name = implode(' / ', $localities);
                    $words = preg_split('/[^A-Z0-9]+/', strtoupper(Str::ascii($localities[0])), -1, PREG_SPLIT_NO_EMPTY);
                    $prefix = count($words) > 1
                        ? implode('', array_map(fn ($word) => $word[0], array_slice($words, 0, 3)))
                        : substr($words[0], 0, 3);
                    self::$regions[$slug][$postal] = [
                        'postal_code' => $postal,
                        'name' => Str::limit($name, 75, '').' Lane',
                        'code' => $slug === 'region-4a' && $postal === '4009' ? 'STC-01' : $prefix.'-'.$postal,
                    ];
                }
            }
        }

        return self::$regions[$region] ?? [];
    }
}
