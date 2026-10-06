<?php

namespace App\Services\Logistics\Sorting;

use App\Models\LogisticsHub;
use Illuminate\Support\Facades\DB;

class SortingLocks
{
    /** Acquire the routing gate before any domain rows used by a routing transaction. */
    public static function network(): void
    {
        DB::table('permissions')->where('slug', 'platform-settings.manage')->lockForUpdate()->first();
    }

    /** Always acquire the network gate before the hub, then custody/resource rows. */
    public static function hub(string $hubId): void
    {
        self::network();
        LogisticsHub::query()->whereKey($hubId)->lockForUpdate()->firstOrFail();
    }
}
