<?php

namespace App\Services\Finance;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

final class FinanceDateRange
{
    public static function start(array $filters): ?CarbonImmutable
    {
        return empty($filters['date_from']) ? null : CarbonImmutable::parse($filters['date_from'], 'Asia/Manila')->startOfDay()->utc();
    }

    public static function until(array $filters): ?CarbonImmutable
    {
        return empty($filters['date_to']) ? null : CarbonImmutable::parse($filters['date_to'], 'Asia/Manila')->addDay()->startOfDay()->utc();
    }

    public static function apply(Builder $query, string $column, array $filters): Builder
    {
        $from = self::start($filters);
        $until = self::until($filters);

        return $query->when($from, fn ($q) => $q->where($column, '>=', $from))
            ->when($until, fn ($q) => $q->where($column, '<', $until));
    }
}
