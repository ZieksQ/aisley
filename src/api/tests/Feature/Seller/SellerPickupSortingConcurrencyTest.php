<?php

namespace Tests\Feature\Seller;

use App\Enums\OrderStatus;
use App\Models\SortingPlan;
use App\Models\Waybill;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\InterleavesRoutingGate;
use Tests\Support\SellerPickupSortingFixtures;
use Tests\TestCase;

class SellerPickupSortingConcurrencyTest extends TestCase
{
    use DatabaseMigrations { runDatabaseMigrations as private migratePickupDatabase; }
    use InterleavesRoutingGate, SellerPickupSortingFixtures;

    public function runDatabaseMigrations(): void
    {
        if (DB::getDriverName() !== 'pgsql' || ! extension_loaded('pcntl') || ! str_starts_with((string) config('database.connections.pgsql.database'), 'aisley_pod_test_')) {
            $this->markTestSkipped('Requires a disposable run-delivery-postgres database and independent pcntl workers.');
        }
        $this->migratePickupDatabase();
    }

    public function test_pickup_waits_for_activation_without_holding_the_hub_or_deadlocking(): void
    {
        $context = $this->pickupContext();
        $key = (string) Str::uuid();
        $result = $this->interleaveRoutingGate(
            fn () => ['id' => $this->requestPickup($context, $key)->id],
            fn () => $this->activateNextPlan($context),
        );
        $waybill = Waybill::with('snapshot')->sole();
        $this->assertSame($context['next']['version']['id'], $waybill->snapshot->payload['sort_plan']['version_id']);
        $this->assertSame('LANE-5', $waybill->snapshot->payload['sort_plan']['lane_code']);
        $this->assertSame($context['next']['plan_id'], SortingPlan::where('is_active', true)->sole()->id);
        $this->assertSame(OrderStatus::ReadyForPickup, $context['order']->fresh()->status);
        $this->assertSame($result['id'], $this->requestPickup($context, $key)->id);
        $this->assertDatabaseCount('seller_pickup_requests', 1);
        $this->assertDatabaseCount('waybills', 1);
        $this->assertSame(1, $context['order']->statusEvents()->where('to_status', 'ready_for_pickup')->count());
    }
}
