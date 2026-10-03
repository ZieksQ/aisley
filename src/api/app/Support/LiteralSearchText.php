<?php

namespace App\Support;

use Illuminate\Support\Str;

class LiteralSearchText
{
    public static function escape(string $query): string
    {
        return str_replace(['!', '%', '_'], ['!!', '!%', '!_'], Str::lower($query));
    }
}
