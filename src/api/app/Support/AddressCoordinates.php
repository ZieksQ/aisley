<?php

namespace App\Support;

use Closure;

final class AddressCoordinates
{
    public static function valid(mixed $latitude, mixed $longitude): bool
    {
        return is_numeric($latitude) && is_numeric($longitude)
            && is_finite((float) $latitude) && is_finite((float) $longitude)
            && abs((float) $latitude) <= 90 && abs((float) $longitude) <= 180;
    }

    public static function rules(string $axis): array
    {
        return ['bail', 'required', 'numeric',
            static function (string $attribute, mixed $value, Closure $fail): void {
                if (! is_numeric($value) || ! is_finite((float) $value)) {
                    $fail('The '.$attribute.' must be a finite coordinate.');
                }
            },
            $axis === 'latitude' ? 'between:-90,90' : 'between:-180,180',
        ];
    }
}
