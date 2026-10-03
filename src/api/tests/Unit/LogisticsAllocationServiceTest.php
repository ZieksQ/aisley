<?php

namespace Tests\Unit;

use App\Services\Finance\LogisticsAllocationService;
use Tests\TestCase;

class LogisticsAllocationServiceTest extends TestCase
{
    public function test_pool_is_allocated_pro_rata_by_frozen_leg_charge_with_stable_remainder(): void
    {
        $shares = app(LogisticsAllocationService::class)->distribute([
            ['stable_index' => 0, 'organization_id' => 'first', 'quoted_charge_cents' => 100],
            ['stable_index' => 1, 'organization_id' => 'middle', 'quoted_charge_cents' => 300],
            ['stable_index' => 2, 'organization_id' => 'last', 'quoted_charge_cents' => 600],
        ], 887);

        $this->assertSame([89, 266, 532], array_column($shares, 'amount_cents'));
        $this->assertSame(887, collect($shares)->sum('amount_cents'));
    }
}
