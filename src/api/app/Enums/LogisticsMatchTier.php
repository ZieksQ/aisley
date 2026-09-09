<?php

namespace App\Enums;

enum LogisticsMatchTier: string
{
    case SameCity = 'same_city';
    case SameProvince = 'same_province';
    case SameCountry = 'same_country';
    case Other = 'other';

    public function rank(): int
    {
        return match ($this) {
            self::SameCity => 0,
            self::SameProvince => 1,
            self::SameCountry => 2,
            self::Other => 3,
        };
    }
}
