<?php

namespace Tests\Feature\Seller;

use App\Enums\OrderStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Support\SellerPickupSortingFixtures;
use Tests\TestCase;

class SellerPickupSortingLockTest extends TestCase
{
    use RefreshDatabase;
    use SellerPickupSortingFixtures;

    public function test_pickup_hint_uses_the_active_version_and_replay_preserves_it_after_activation(): void
    {
        $context = $this->pickupContext();
        $key = (string) Str::uuid();
        $pickup = $this->requestPickup($context, $key);
        $waybill = $pickup->waybills->sole()->load('snapshot');
        $payload = $waybill->snapshot->payload;
        $this->assertSame($context['first']['version']['id'], $payload['sort_plan']['version_id']);
        $this->assertSame('LANE-1', $payload['sort_plan']['lane_code']);

        $this->activateNextPlan($context);
        $replay = $this->requestPickup($context, $key);
        $this->assertSame($pickup->id, $replay->id);
        $this->assertSame($waybill->id, $replay->waybills->sole()->id);
        $this->assertSame($payload, $waybill->fresh('snapshot')->snapshot->payload);
        $this->assertSame(OrderStatus::ReadyForPickup, $context['order']->fresh()->status);
        $this->assertSame('100.00', $context['order']->fresh()->payable_total);
        $this->assertSame(1, $context['order']->statusEvents()->where('to_status', 'ready_for_pickup')->count());

        $context['order'] = $this->order($context['shop']);
        $context['order']->update(['status' => OrderStatus::SellerProcessing]);
        $nextPickup = $this->requestPickup($context, (string) Str::uuid());
        $nextWaybill = $nextPickup->waybills->sole()->load('snapshot');
        $this->assertSame($context['next']['version']['id'], $nextWaybill->snapshot->payload['sort_plan']['version_id']);
        $this->assertSame('LANE-5', $nextWaybill->snapshot->payload['sort_plan']['lane_code']);
        $this->assertSame($context['organization']->id, $nextPickup->logistics_organization_id);
        $this->assertDatabaseCount('seller_pickup_requests', 2);
        $this->assertDatabaseCount('waybills', 2);
    }
}
