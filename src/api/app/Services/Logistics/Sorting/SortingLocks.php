<?php

namespace App\Services\Logistics\Sorting;

use App\Models\LogisticsHub;
use Illuminate\Support\Facades\DB;

class SortingLocks
{
    /** Always acquire the network gate before the hub, then custody/resource rows. */
    public static function hub(string $hubId): void
    {
        DB::table('permissions')->where('slug', 'platform-settings.manage')->lockForUpdate()->first();
        LogisticsHub::query()->whereKey($hubId)->lockForUpdate()->firstOrFail();
    }
}
