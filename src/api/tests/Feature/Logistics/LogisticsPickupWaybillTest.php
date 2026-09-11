<?php

namespace Tests\Feature\Logistics;

use App\Enums\AddressType;
use App\Enums\CategoryStatus;
use App\Enums\CourierAffiliationStatus;
use App\Enums\InventoryMovementType;
use App\Enums\InventorySkuStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\ProductStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Jobs\BuildPickupRouteManifestJob;
use App\Models\AddressCoordinateDefault;
use App\Models\Category;
use App\Models\CheckoutBatch;
use App\Models\CheckoutQuote;
use App\Models\InventoryBalance;
use App\Models\InventoryMovement;
use App\Models\InventorySku;
use App\Models\Order;
use App\Models\PickupRouteManifest;
use App\Models\PickupSchedule;
use App\Models\Product;
use App\Models\Shop;
use App\Models\ShopCategory;
use App\Models\User;
use App\Services\Logistics\BuildPickupRouteManifest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\TestCase;

class LogisticsPickupWaybillTest extends TestCase
{
    use RefreshDatabase;

    public function test_options_rank_exact_psgc_matches_and_truthfully_fall_back_without_distance(): void
    {
        [$seller] = $this->sellerShop();
        [, $near] = $this->logistics('Near Logistics', 'Manila', 'Metro Manila');
        [, $province] = $this->logistics('Province Logistics', 'Makati City', 'Metro Manila');
        config()->set('services.geoapify.server_key', null);

        $this->actingAs($seller)->getJson('/api/v1/seller/logistics-options')
            ->assertOk()
            ->assertJsonPath('data.0.id', $near->id)
            ->assertJsonPath('data.0.match_tier', 'same_city')
            ->assertJsonPath('data.0.recommended', false)
            ->assertJsonPath('data.0.distance_km', null)
            ->assertJsonPath('data.0.status', 'unavailable')
            ->assertJsonPath('data.1.id', $province->id)
            ->assertJsonPath('meta.attribution.0', 'Geoapify');
    }

    public function test_geoapify_road_distance_breaks_an_exact_match_tie(): void
    {
        [$seller] = $this->sellerShop(true);
        [, $far] = $this->logistics('A Far Logistics', 'Manila', 'Metro Manila', true);
        [, $near] = $this->logistics('Z Near Logistics', 'Manila', 'Metro Manila', true, 14.61, 121.02);
        config()->set('services.geoapify.server_key', 'server-secret');
        Http::fake(['api.geoapify.com/*' => Http::response(['sources_to_targets' => [[['distance' => 12500], ['distance' => 3200]]]])]);

        $this->actingAs($seller)->getJson('/api/v1/seller/logistics-options')
            ->assertOk()->assertJsonPath('data.0.id', $near->id)->assertJsonPath('data.0.distance_km', 3.2)
            ->assertJsonPath('data.0.recommended', true)->assertJsonPath('data.1.id', $far->id);
        Http::assertSent(fn ($request) => $request->url() === 'https://api.geoapify.com/v1/routematrix?apiKey=server-secret'
            && $request['mode'] === 'drive' && count($request['sources']) === 1 && count($request['targets']) === 2);
    }

    public function test_pickup_creates_immutable_waybill_and_notifies_only_selected_logistics(): void
    {
        [$seller, $shop] = $this->sellerShop();
        $order = $this->order($shop);
        $order->update(['status' => OrderStatus::SellerProcessing]);
        [$selectedUser, $selected] = $this->logistics('Selected Logistics', 'Manila', 'Metro Manila');
        [$otherUser] = $this->logistics('Other Logistics', 'Quezon City', 'Metro Manila');
        $pickupAddress = $seller->addresses()->sole();
        $key = (string) Str::uuid();

        $response = $this->actingAs($seller)->withHeader('Idempotency-Key', $key)->postJson('/api/v1/seller/orders/pickup-requests', [
            'order_ids' => [$order->id], 'pickup_address_id' => $pickupAddress->id, 'logistics_organization_id' => $selected->id,
        ])->assertOk()->assertJsonPath('data.logistics_organization_id', $selected->id)->assertJsonCount(1, 'data.waybills');
        $waybillId = $response->json('data.waybills.0.id');
        $pickupId = $response->json('data.id');

        $this->withHeader('Idempotency-Key', $key)->postJson('/api/v1/seller/orders/pickup-requests', [
            'order_ids' => [$order->id], 'pickup_address_id' => $pickupAddress->id, 'logistics_organization_id' => $selected->id,
        ])->assertOk()->assertJsonPath('data.waybills.0.id', $waybillId);
        $this->assertDatabaseCount('waybills', 1);
        $this->assertDatabaseHas('notifications', ['notifiable_id' => $selectedUser->id, 'type' => 'logistics-pickup.requested']);
        $this->assertDatabaseMissing('notifications', ['notifiable_id' => $otherUser->id, 'type' => 'logistics-pickup.requested']);

        $pdf = $this->get("/api/v1/seller/orders/{$order->id}/waybill");
        $pdf->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringContainsString('private', (string) $pdf->headers->get('Cache-Control'));
        $this->assertStringContainsString('no-store', (string) $pdf->headers->get('Cache-Control'));
        $this->assertStringStartsWith('%PDF-', (string) $pdf->getContent());
        $this->assertSame(1, preg_match_all('/\/Type\s*\/Page\b/', (string) $pdf->getContent()));
        $this->assertDatabaseCount('waybill_access_events', 1);
        $this->get("/api/v1/seller/pickup-requests/{$pickupId}/waybills.pdf")->assertOk();
        $this->assertDatabaseCount('waybill_access_events', 2);
        $this->assertSame(OrderStatus::ReadyForPickup, $order->fresh()->status);
        $this->assertSame(1, InventoryBalance::firstOrFail()->reserved);
        $this->getJson('/api/v1/seller/logistics-options')->assertOk()
            ->assertJsonPath('data.0.default', true)
            ->assertJsonPath('data.0.id', $selected->id);
    }

    public function test_logistics_schedule_is_tenant_scoped_and_courier_can_accept_and_resolve_only_assigned_waybill(): void
    {
        [$seller, $shop] = $this->sellerShop();
        $order = $this->order($shop);
        $order->update(['status' => OrderStatus::SellerProcessing]);
        [$logistics, $organization, $hub] = $this->logistics('Assigned Logistics', 'Manila', 'Metro Manila');
        [$foreign] = $this->logistics('Foreign Logistics', 'Cebu City', 'Cebu');
        $courier = $this->courier($organization->id, $hub->id);
        $pickupAddress = $seller->addresses()->sole();
        $pickup = $this->actingAs($seller)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/seller/orders/pickup-requests', ['order_ids' => [$order->id], 'pickup_address_id' => $pickupAddress->id, 'logistics_organization_id' => $organization->id])->json('data');

        $this->actingAs($foreign)->getJson("/api/v1/logistics/pickups/{$pickup['id']}")->assertNotFound();
        $this->actingAs($logistics)->getJson('/api/v1/logistics/pickup-couriers')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $courier->id);
        $this->actingAs($logistics)->getJson('/api/v1/logistics/pickups?search='.urlencode($order->reference))
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $pickup['id']);
        $this->getJson("/api/v1/logistics/pickups/{$pickup['id']}/waybills")
            ->assertOk()->assertJsonPath('data.0.reference', $pickup['waybills'][0]['reference']);
        $this->get("/api/v1/logistics/waybills/{$pickup['waybills'][0]['id']}.pdf")
            ->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->actingAs($foreign)->get("/api/v1/logistics/waybills/{$pickup['waybills'][0]['id']}.pdf")->assertNotFound();
        $schedule = $this->actingAs($logistics)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/pickup-schedules', [
            'order_ids' => [$order->id], 'courier_id' => $courier->id,
            'starts_at' => now()->addHours(3)->toISOString(), 'ends_at' => now()->addHours(4)->toISOString(),
        ])->assertCreated()->assertJsonPath('data.order_ids.0', $order->id)->json('data');
        $this->assertSame(OrderStatus::ReadyForPickup, $order->fresh()->status);
        $this->assertDatabaseCount('pickup_schedule_reminders', 1);
        $this->actingAs($logistics)->getJson("/api/v1/logistics/pickups/{$pickup['id']}")
            ->assertOk()
            ->assertJsonPath('data.orders.0.schedule.id', $schedule['id']);
        $sellerNotification = $this->actingAs($seller)->getJson('/api/v1/seller/notifications?status=unread')
            ->assertOk()
            ->assertJsonPath('data.0.type', 'pickup-schedule.assigned')
            ->assertJsonPath('data.0.title', 'Pickup scheduled')
            ->assertJsonPath('data.0.summary', fn ($value) => is_string($value) && str_contains($value, 'PHT'))
            ->assertJsonPath('data.0.schedule.id', $schedule['id'])
            ->assertJsonPath('data.0.schedule.order_count', 1)
            ->json('data.0');
        $this->getJson('/api/v1/seller/orders?status=ready_for_pickup')
            ->assertOk()
            ->assertJsonPath('data.0.pickup.schedule.id', $schedule['id'])
            ->assertJsonPath('data.0.pickup.schedule.timezone', 'Asia/Manila');
        $this->getJson("/api/v1/seller/notifications/{$sellerNotification['id']}")
            ->assertOk()
            ->assertJsonPath('data.schedule.reference', $schedule['reference']);
        $this->postJson("/api/v1/seller/notifications/{$sellerNotification['id']}/read")
            ->assertOk()
            ->assertJsonPath('data.read_at', fn ($value) => is_string($value));
        $legacyNotification = $seller->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => 'pickup-schedule.assigned',
            'data' => [
                'schedule_id' => $schedule['id'],
                'reference' => $schedule['reference'],
                'starts_at' => $schedule['starts_at'],
                'ends_at' => $schedule['ends_at'],
                'timezone' => 'UTC',
                'order_count' => 1,
                'pickup_area' => ['city_municipality' => 'Manila', 'province' => 'Metro Manila', 'region' => 'NCR'],
            ],
        ]);
        $this->getJson("/api/v1/seller/notifications/{$legacyNotification->id}")
            ->assertOk()
            ->assertJsonPath('data.title', 'Pickup scheduled')
            ->assertJsonPath('data.summary', fn ($value) => is_string($value) && str_contains($value, $schedule['reference']) && str_contains($value, 'PHT'));
        [$otherSeller] = $this->sellerShop();
        $this->actingAs($otherSeller)->getJson("/api/v1/seller/notifications/{$sellerNotification['id']}")->assertNotFound();

        $schedule = $this->actingAs($logistics)->patchJson("/api/v1/logistics/pickup-schedules/{$schedule['id']}", [
            'expected_revision' => 1, 'reason' => 'Move the future collection window.',
            'starts_at' => now()->addHours(4)->toISOString(), 'ends_at' => now()->addHours(5)->toISOString(),
        ])->assertOk()->assertJsonPath('data.revision', 2)->json('data');
        $this->assertDatabaseHas('pickup_schedule_reminders', ['pickup_schedule_id' => $schedule['id'], 'schedule_revision' => 1, 'status' => 'superseded']);
        $this->assertDatabaseHas('pickup_schedule_reminders', ['pickup_schedule_id' => $schedule['id'], 'schedule_revision' => 2, 'status' => 'pending']);

        $task = $this->actingAs($courier)->getJson('/api/v1/courier/first-mile-tasks')->assertOk()->assertJsonCount(1, 'data')->json('data.0');
        $this->postJson("/api/v1/courier/first-mile-tasks/{$task['id']}/accept")->assertOk()->assertJsonPath('data.status', 'accepted');
        $payload = 'AISLEY:WB:1:'.$pickup['waybills'][0]['reference'];
        $this->postJson('/api/v1/courier/waybills/resolve', ['payload' => $payload])->assertOk()->assertJsonPath('data.matched', true)->assertJsonPath('data.task.id', $task['id']);

        $foreignCourier = $this->courier($foreign->logisticsOrganization->id, $foreign->logisticsOrganization->hub->id);
        $this->actingAs($foreignCourier)->postJson('/api/v1/courier/waybills/resolve', ['payload' => $payload])->assertNotFound();
        $this->actingAs($logistics)->postJson("/api/v1/logistics/pickup-schedules/{$schedule['id']}/cancel", ['expected_revision' => 2, 'reason' => 'Seller requested a future reschedule.'])->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->assertDatabaseHas('pickup_schedule_reminders', ['pickup_schedule_id' => $schedule['id'], 'status' => 'suppressed']);
    }

    public function test_overlapping_schedule_for_the_same_courier_returns_a_visible_conflict_contract(): void
    {
        [$seller, $shop] = $this->sellerShop();
        $firstOrder = $this->order($shop);
        $secondOrder = $this->order($shop);
        $firstOrder->update(['status' => OrderStatus::SellerProcessing]);
        $secondOrder->update(['status' => OrderStatus::SellerProcessing]);
        [$logistics, $organization, $hub] = $this->logistics('Conflict Logistics', 'Manila', 'Metro Manila');
        $courier = $this->courier($organization->id, $hub->id);
        $pickupAddress = $seller->addresses()->sole();
        $this->actingAs($seller)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/seller/orders/pickup-requests', [
            'order_ids' => [$firstOrder->id, $secondOrder->id],
            'pickup_address_id' => $pickupAddress->id,
            'logistics_organization_id' => $organization->id,
        ])->assertOk();
        $startsAt = now()->addHours(3);
        $endsAt = now()->addHours(4);

        $this->actingAs($logistics)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/pickup-schedules', [
            'order_ids' => [$firstOrder->id],
            'courier_id' => $courier->id,
            'starts_at' => $startsAt->toISOString(),
            'ends_at' => $endsAt->toISOString(),
        ])->assertCreated();

        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/pickup-schedules', [
            'order_ids' => [$secondOrder->id],
            'courier_id' => $courier->id,
            'starts_at' => $startsAt->copy()->addMinutes(30)->toISOString(),
            'ends_at' => $endsAt->copy()->addMinutes(30)->toISOString(),
        ])->assertConflict()
            ->assertJsonPath('code', 'COURIER_SCHEDULE_CONFLICT')
            ->assertJsonPath('message', 'The Courier already has an overlapping pickup schedule.');
        $this->assertDatabaseCount('pickup_schedules', 1);
        $this->assertDatabaseMissing('first_mile_tasks', ['order_id' => $secondOrder->id]);
    }

    public function test_one_schedule_combines_bulk_pickups_from_multiple_sellers_with_a_thirty_parcel_limit(): void
    {
        [$firstSeller, $firstShop] = $this->sellerShop();
        [$secondSeller, $secondShop] = $this->sellerShop();
        $firstShop->update(['name' => 'Zeta Shop']);
        $secondShop->update(['name' => 'Alpha Shop']);
        $secondSeller->addresses()->firstOrFail()->update(['address_line_1' => '2 Seller Road', 'barangay' => 'Malate']);
        $firstOrders = collect([$this->order($firstShop), $this->order($firstShop)]);
        $secondOrders = collect([$this->order($secondShop), $this->order($secondShop)]);
        $orders = $firstOrders->concat($secondOrders);
        $orders->each->update(['status' => OrderStatus::SellerProcessing]);
        [$logistics, $organization, $hub] = $this->logistics('Multi Seller Logistics', 'Manila', 'Metro Manila');
        $courier = $this->courier($organization->id, $hub->id);

        $firstPickup = $this->actingAs($firstSeller)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/seller/orders/pickup-requests', [
                'order_ids' => $firstOrders->pluck('id')->all(),
                'pickup_address_id' => $firstSeller->addresses()->sole()->id,
                'logistics_organization_id' => $organization->id,
            ])->assertOk()->json('data');
        $secondPickup = $this->actingAs($secondSeller)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/seller/orders/pickup-requests', [
                'order_ids' => $secondOrders->pluck('id')->all(),
                'pickup_address_id' => $secondSeller->addresses()->sole()->id,
                'logistics_organization_id' => $organization->id,
            ])->assertOk()->json('data');

        $this->actingAs($logistics)->getJson('/api/v1/logistics/pickups?include_orders=1&has_unscheduled=1&sort=shop_created')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.shop.name', 'Alpha Shop')
            ->assertJsonCount(2, 'data.0.orders')
            ->assertJsonCount(2, 'data.1.orders');

        $schedule = $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/logistics/pickup-schedules', [
                'order_ids' => $orders->pluck('id')->all(),
                'courier_id' => $courier->id,
                'starts_at' => now()->addHours(3)->toISOString(),
                'ends_at' => now()->addHours(4)->toISOString(),
            ])->assertCreated()
            ->assertJsonCount(4, 'data.order_ids')
            ->json('data');

        $this->assertDatabaseCount('pickup_schedules', 1);
        $this->assertDatabaseCount('pickup_schedule_orders', 4);
        $this->assertDatabaseCount('first_mile_tasks', 4);
        $this->assertDatabaseHas('seller_pickup_requests', ['id' => $firstPickup['id'], 'status' => 'scheduled']);
        $this->assertDatabaseHas('seller_pickup_requests', ['id' => $secondPickup['id'], 'status' => 'scheduled']);
        $this->assertSame(2, $firstSeller->notifications()->where('type', 'pickup-schedule.assigned')->sole()->data['order_count']);
        $this->assertSame(2, $secondSeller->notifications()->where('type', 'pickup-schedule.assigned')->sole()->data['order_count']);
        $courierNotification = $courier->notifications()->where('type', 'pickup-schedule.assigned')->sole();
        $this->assertSame(4, $courierNotification->data['order_count']);
        $this->assertSame(2, $courierNotification->data['pickup_stop_count']);
        $this->assertSame($schedule['id'], $courierNotification->data['schedule_id']);

        $scheduleList = $this->actingAs($logistics)->getJson('/api/v1/logistics/pickup-schedules')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $schedule['id'])
            ->assertJsonPath('data.0.courier.id', $courier->id)
            ->assertJsonPath('data.0.courier.name', 'Cora Rider')
            ->assertJsonPath('data.0.parcel_count', 4)
            ->assertJsonPath('data.0.remaining_parcel_count', 4)
            ->assertJsonCount(2, 'data.0.pickup_requests');
        $this->assertStringContainsString('private', (string) $scheduleList->headers->get('Cache-Control'));
        $this->assertStringContainsString('no-store', (string) $scheduleList->headers->get('Cache-Control'));
        [$foreignLogistics] = $this->logistics('Foreign Schedule Logistics', 'Cebu City', 'Cebu');
        $this->actingAs($foreignLogistics)->getJson('/api/v1/logistics/pickup-schedules')->assertOk()->assertJsonCount(0, 'data');

        $this->actingAs($logistics)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/logistics/pickup-schedules', [
                'order_ids' => collect(range(1, 31))->map(fn () => (string) Str::uuid())->all(),
                'courier_id' => $courier->id,
                'starts_at' => now()->addHours(5)->toISOString(),
                'ends_at' => now()->addHours(6)->toISOString(),
            ])->assertUnprocessable()
            ->assertJsonValidationErrors('order_ids');
    }

    public function test_courier_confirms_qr_and_manual_pickups_idempotently_without_changing_order_status(): void
    {
        [$seller, $shop] = $this->sellerShop();
        $manualOrder = $this->order($shop);
        $qrOrder = $this->order($shop);
        $manualOrder->update(['status' => OrderStatus::SellerProcessing]);
        $qrOrder->update(['status' => OrderStatus::SellerProcessing]);
        [$logistics, $organization, $hub] = $this->logistics('Pickup Logistics', 'Manila', 'Metro Manila');
        $courier = $this->courier($organization->id, $hub->id);
        $pickup = $this->actingAs($seller)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/seller/orders/pickup-requests', [
                'order_ids' => [$manualOrder->id, $qrOrder->id],
                'pickup_address_id' => $seller->addresses()->sole()->id,
                'logistics_organization_id' => $organization->id,
            ])->assertOk()->json('data');
        $this->actingAs($logistics)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/logistics/pickup-schedules', [
                'order_ids' => [$manualOrder->id, $qrOrder->id],
                'courier_id' => $courier->id,
                'starts_at' => now()->addHours(3)->toISOString(),
                'ends_at' => now()->addHours(4)->toISOString(),
            ])->assertCreated();

        $taskResponse = $this->actingAs($courier)->getJson('/api/v1/courier/first-mile-tasks')
            ->assertOk()
            ->assertJsonPath('meta.per_page', 25);
        $this->assertStringContainsString('private', (string) $taskResponse->headers->get('Cache-Control'));
        $this->assertStringContainsString('no-store', (string) $taskResponse->headers->get('Cache-Control'));
        $tasks = $taskResponse->json('data');
        foreach ($tasks as $task) {
            $this->postJson("/api/v1/courier/first-mile-tasks/{$task['id']}/accept")->assertOk();
        }
        $manualTask = collect($tasks)->firstWhere('order.id', $manualOrder->id);
        $qrTask = collect($tasks)->firstWhere('order.id', $qrOrder->id);

        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson("/api/v1/courier/first-mile-tasks/{$manualTask['id']}/pickup", [
                'identifier_type' => 'order_id',
                'identifier' => 'WRONG-ORDER',
            ])->assertNotFound();
        $this->assertDatabaseCount('courier_pickup_confirmations', 0);

        $manualKey = (string) Str::uuid();
        $manualPayload = ['identifier_type' => 'order_id', 'identifier' => strtolower($manualOrder->reference)];
        $this->withHeader('Idempotency-Key', $manualKey)
            ->postJson("/api/v1/courier/first-mile-tasks/{$manualTask['id']}/pickup", $manualPayload)
            ->assertOk()
            ->assertJsonPath('data.task_status', 'picked_up_from_seller')
            ->assertJsonPath('data.order_status', 'ready_for_pickup')
            ->assertJsonPath('data.idempotent', false)
            ->assertJsonPath('data.next_step', 'logistics_receipt');
        $this->withHeader('Idempotency-Key', $manualKey)
            ->postJson("/api/v1/courier/first-mile-tasks/{$manualTask['id']}/pickup", $manualPayload)
            ->assertOk()
            ->assertJsonPath('data.idempotent', true);

        $unrelatedCourier = $this->courier($organization->id, $hub->id);
        $this->actingAs($unrelatedCourier)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson("/api/v1/courier/first-mile-tasks/{$qrTask['id']}/pickup", [
                'identifier_type' => 'order_id',
                'identifier' => $qrOrder->reference,
            ])->assertNotFound();
        $this->actingAs($courier)->withHeader('Idempotency-Key', $manualKey)
            ->postJson("/api/v1/courier/first-mile-tasks/{$qrTask['id']}/pickup", [
                'identifier_type' => 'order_id',
                'identifier' => $qrOrder->reference,
            ])->assertConflict()->assertJsonPath('code', 'IDEMPOTENCY_KEY_REUSED');

        $qrReference = collect($pickup['waybills'])->firstWhere('order_id', $qrOrder->id)['reference'];
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson("/api/v1/courier/first-mile-tasks/{$qrTask['id']}/pickup", [
                'identifier_type' => 'qr',
                'identifier' => 'AISLEY:WB:1:'.$qrReference,
            ])->assertOk()->assertJsonPath('data.task_status', 'picked_up_from_seller');

        $this->assertDatabaseCount('courier_pickup_confirmations', 2);
        $this->assertDatabaseHas('courier_pickup_confirmations', [
            'first_mile_task_id' => $manualTask['id'],
            'previous_status' => 'accepted',
            'new_status' => 'picked_up_from_seller',
            'schedule_revision' => 1,
        ]);
        $this->assertSame(OrderStatus::ReadyForPickup, $manualOrder->fresh()->status);
        $this->assertSame(OrderStatus::ReadyForPickup, $qrOrder->fresh()->status);
        $this->assertSame(0, (int) InventoryBalance::query()->sum('reserved'));
        $this->assertSame(18, (int) InventoryBalance::query()->sum('on_hand'));
        $this->assertDatabaseCount('inventory_movements', 4);
        $this->getJson('/api/v1/courier/first-mile-tasks')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($logistics)->postJson("/api/v1/logistics/pickup-schedules/{$manualTask['schedule']['id']}/cancel", [
            'expected_revision' => 1,
            'reason' => 'This must not erase recorded custody.',
        ])->assertConflict()->assertJsonPath('code', 'SCHEDULE_CUSTODY_STARTED');
    }

    public function test_bulk_pickup_route_groups_parcels_and_returns_a_minimal_matrix_sequence(): void
    {
        [$seller, $shop] = $this->sellerShop(true);
        $firstOrder = $this->order($shop);
        $secondOrder = $this->order($shop);
        $firstOrder->update(['status' => OrderStatus::SellerProcessing]);
        $secondOrder->update(['status' => OrderStatus::SellerProcessing]);
        [$logistics, $organization, $hub] = $this->logistics('Route Logistics', 'Makati City', 'Metro Manila', true);
        $courier = $this->courier($organization->id, $hub->id);
        config()->set('services.geoapify.server_key', 'server-secret');
        Http::fake(function ($request) {
            if (str_contains($request->url(), '/v1/routematrix')) {
                return Http::response(['sources_to_targets' => [
                    [['distance' => 0, 'time' => 0], ['distance' => 5400, 'time' => 720]],
                    [['distance' => 5100, 'time' => 680], ['distance' => 0, 'time' => 0]],
                ]]);
            }
            if (str_contains($request->url(), '/v1/routing')) {
                return Http::response(['type' => 'FeatureCollection', 'features' => [[
                    'type' => 'Feature',
                    'geometry' => ['type' => 'MultiLineString', 'coordinates' => [[
                        [121.03, 14.65], [121.01, 14.63], [120.98, 14.6], [121.02, 14.62], [121.03, 14.65],
                    ]]],
                    'properties' => [],
                ]]]);
            }

            return Http::response('tile-bytes', 200, ['Content-Type' => 'image/png']);
        });

        $this->actingAs($seller)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/seller/orders/pickup-requests', [
                'order_ids' => [$firstOrder->id, $secondOrder->id],
                'pickup_address_id' => $seller->addresses()->sole()->id,
                'logistics_organization_id' => $organization->id,
            ])->assertOk();
        $schedule = $this->actingAs($logistics)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/logistics/pickup-schedules', [
                'order_ids' => [$firstOrder->id, $secondOrder->id],
                'courier_id' => $courier->id,
                'starts_at' => now()->addHours(3)->toISOString(),
                'ends_at' => now()->addHours(4)->toISOString(),
            ])->assertCreated()->json('data');

        app(BuildPickupRouteManifest::class)->handle($schedule['id'], 1);
        $requestCount = count(Http::recorded());
        app(BuildPickupRouteManifest::class)->handle($schedule['id'], 1);
        $this->assertCount($requestCount, Http::recorded());
        $response = $this->actingAs($courier)
            ->getJson("/api/v1/courier/pickup-schedules/{$schedule['id']}/route-manifest")
            ->assertOk()
            ->assertJsonPath('data.status', 'ready')
            ->assertJsonPath('data.summary.parcel_count', 2)
            ->assertJsonPath('data.summary.pickup_stop_count', 1)
            ->assertJsonPath('data.summary.distance_metres', 10500)
            ->assertJsonPath('data.summary.duration_seconds', 1400)
            ->assertJsonPath('data.summary.heuristic', 'nearest_next_stop')
            ->assertJsonPath('data.stops.0.kind', 'hub')
            ->assertJsonPath('data.stops.1.kind', 'pickup')
            ->assertJsonCount(2, 'data.stops.1.tasks')
            ->assertJsonPath('data.stops.2.kind', 'hub')
            ->assertJsonPath('data.geojson.type', 'FeatureCollection')
            ->assertJsonPath('data.geojson.features.0.properties.kind', 'route_line')
            ->assertJsonPath('data.geojson.features.0.properties.geometry_source', 'geoapify_routing')
            ->assertJsonCount(5, 'data.geojson.features.0.geometry.coordinates')
            ->assertJsonPath('data.geojson.features.0.geometry.coordinates.0', [121.03, 14.65])
            ->assertJsonPath('data.geojson.features.0.geometry.coordinates.4', [121.03, 14.65]);
        $this->assertStringContainsString('private', (string) $response->headers->get('Cache-Control'));
        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
        Http::assertSent(fn ($request) => str_contains($request->url(), '/v1/routematrix')
            && count($request['sources']) === 2
            && count($request['targets']) === 2
            && $request['sources'][0]['location'] === [121.03, 14.65]
            && $request['sources'][1]['location'] === [120.98, 14.6]);
        Http::assertSent(fn ($request) => str_contains($request->url(), '/v1/routing')
            && $request['waypoints'] === '14.65,121.03|14.6,120.98|14.65,121.03'
            && $request['mode'] === 'drive');

        $manifest = PickupRouteManifest::query()->where('pickup_schedule_id', $schedule['id'])->sole();
        $legacyGeojson = $manifest->geojson;
        $legacyGeojson['features'][0]['properties'] = ['kind' => 'stop_sequence_visual'];
        $manifest->update(['coordinate_fingerprint' => 'legacy', 'geojson' => $legacyGeojson]);
        Queue::fake();
        $this->getJson("/api/v1/courier/pickup-schedules/{$schedule['id']}/route-manifest")
            ->assertOk()
            ->assertJsonPath('data.status', 'ready')
            ->assertJsonPath('data.geojson.features.0.geometry.type', 'LineString')
            ->assertJsonPath('data.geojson.features.0.properties.kind', 'stop_sequence_visual');
        Queue::assertPushed(BuildPickupRouteManifestJob::class, fn ($job): bool => $job->scheduleId === $schedule['id'] && $job->revision === 1);

        [$foreignUser, $foreignOrganization, $foreignHub] = $this->logistics('Foreign Route Logistics', 'Cebu City', 'Cebu');
        $foreignCourier = $this->courier($foreignOrganization->id, $foreignHub->id);
        $this->actingAs($foreignCourier)->getJson("/api/v1/courier/pickup-schedules/{$schedule['id']}/route-manifest")->assertNotFound();
        $this->actingAs($courier)->getJson('/api/v1/courier/map-style')
            ->assertOk()
            ->assertJsonPath('sources.geoapify.type', 'raster')
            ->assertJsonMissing(['apiKey' => 'server-secret']);
        $tile = $this->get('/api/v1/courier/map-tiles/1/1/1.png')->assertOk();
        $this->assertStringNotContainsString('server-secret', (string) $tile->getContent());
        $this->get('/api/v1/courier/map-tiles/1/1/1.png')->assertOk();
        Http::assertSent(fn ($request) => str_contains($request->url(), 'https://maps.geoapify.com/v1/tile/osm-carto/1/1/1.png')
            && str_contains($request->url(), 'apiKey=server-secret'));
        $tileRequests = Http::recorded()->filter(fn (array $pair): bool => str_contains($pair[0]->url(), 'maps.geoapify.com'));
        $this->assertCount(1, $tileRequests);
        unset($foreignUser);
    }

    public function test_route_manifest_uses_address_defaults_and_fails_honestly_when_none_exist(): void
    {
        [$seller, $shop] = $this->sellerShop();
        $order = $this->order($shop);
        $order->update(['status' => OrderStatus::SellerProcessing]);
        [$logistics, $organization, $hub] = $this->logistics('Default Route Logistics', 'Makati City', 'Metro Manila');
        $courier = $this->courier($organization->id, $hub->id);
        AddressCoordinateDefault::create(['country' => 'ph', 'region' => 'ncr', 'province' => 'metro manila', 'city_municipality' => 'makati city', 'barangay' => 'poblacion', 'latitude' => 14.5547, 'longitude' => 121.0244]);
        AddressCoordinateDefault::create(['country' => 'ph', 'region' => 'ncr', 'province' => 'metro manila', 'city_municipality' => 'manila', 'barangay' => 'ermita', 'latitude' => 14.5832, 'longitude' => 120.9822]);
        config()->set('services.geoapify.server_key', 'server-secret');
        Http::fake(['api.geoapify.com/*' => Http::response(['sources_to_targets' => [
            [['distance' => 0, 'time' => 0], ['distance' => 3200, 'time' => 500]],
            [['distance' => 3300, 'time' => 520], ['distance' => 0, 'time' => 0]],
        ]])]);
        $this->actingAs($seller)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/seller/orders/pickup-requests', [
                'order_ids' => [$order->id],
                'pickup_address_id' => $seller->addresses()->sole()->id,
                'logistics_organization_id' => $organization->id,
            ])->assertOk();
        $schedule = $this->actingAs($logistics)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/logistics/pickup-schedules', [
                'order_ids' => [$order->id],
                'courier_id' => $courier->id,
                'starts_at' => now()->addHours(3)->toISOString(),
                'ends_at' => now()->addHours(4)->toISOString(),
            ])->assertCreated()->json('data');

        app(BuildPickupRouteManifest::class)->handle($schedule['id'], 1);
        $this->actingAs($courier)->getJson("/api/v1/courier/pickup-schedules/{$schedule['id']}/route-manifest")
            ->assertOk()
            ->assertJsonPath('data.status', 'ready')
            ->assertJsonPath('data.coordinate_source', 'address_default')
            ->assertJsonPath('data.stops.1.coordinate_source', 'address_default')
            ->assertJsonPath('data.geojson.features.0.properties.geometry_source', 'stop_sequence_fallback');

        AddressCoordinateDefault::query()->where('city_municipality', 'manila')->delete();
        $manifest = $schedule['id'];
        $record = PickupSchedule::query()->findOrFail($manifest);
        $record->update(['revision' => 2]);
        app(BuildPickupRouteManifest::class)->handle($record->id, 2);
        $this->getJson("/api/v1/courier/pickup-schedules/{$record->id}/route-manifest")
            ->assertOk()
            ->assertJsonPath('data.status', 'unavailable')
            ->assertJsonPath('data.reason', 'missing_pickup_coordinates');
    }

    private function sellerShop(bool $coordinates = false): array
    {
        $seller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
        $category = ShopCategory::create(['name' => 'General '.Str::random(5), 'slug' => 'general-'.Str::lower(Str::random(8)), 'status' => CategoryStatus::Active]);
        $shop = Shop::create(['seller_id' => $seller->id, 'shop_category_id' => $category->id, 'name' => 'Seller Shop', 'slug' => 'seller-'.Str::lower(Str::random(8)), 'status' => ShopStatus::Active, 'contact_number' => '09171111111']);
        $seller->addresses()->create(['type' => AddressType::Both, 'label' => 'Pickup', 'recipient_name' => 'Seller', 'contact_number' => '09171111111', 'address_line_1' => '1 Seller Road', 'barangay' => 'Ermita', 'city_municipality' => 'Manila', 'province' => 'Metro Manila', 'region' => 'NCR', 'postal_code' => '1000', 'country' => 'PH', 'latitude' => $coordinates ? 14.60 : null, 'longitude' => $coordinates ? 120.98 : null, 'is_default' => true]);

        return [$seller, $shop];
    }

    private function logistics(string $name, string $city, string $province, bool $coordinates = false, float $latitude = 14.65, float $longitude = 121.03): array
    {
        $user = User::factory()->create(['role' => UserRole::Logistics, 'status' => UserStatus::Active]);
        $address = $user->addresses()->create(['type' => AddressType::Both, 'label' => 'Hub', 'recipient_name' => 'Operator', 'contact_number' => '09172222222', 'address_line_1' => '1 Hub Road', 'barangay' => 'Poblacion', 'city_municipality' => $city, 'province' => $province, 'region' => 'NCR', 'postal_code' => '1000', 'country' => 'PH', 'latitude' => $coordinates ? $latitude : null, 'longitude' => $coordinates ? $longitude : null, 'is_default' => true]);
        $organization = $user->logisticsOrganization()->create(['business_name' => $name]);
        $hub = $organization->hub()->create(['address_id' => $address->id, 'name' => $name.' Hub']);

        return [$user, $organization, $hub];
    }

    private function courier(string $organizationId, string $hubId): User
    {
        $courier = User::factory()->create(['role' => UserRole::Courier, 'status' => UserStatus::Active]);
        $courier->courierProfile()->create(['first_name' => 'Cora', 'last_name' => 'Rider', 'contact_number' => '09173333333', 'sex' => 'female', 'birth_date' => '1994-01-01']);
        $courier->courierLogisticsAffiliation()->create(['logistics_organization_id' => $organizationId, 'logistics_hub_id' => $hubId, 'status' => CourierAffiliationStatus::Approved]);

        return $courier;
    }

    private function order(Shop $shop): Order
    {
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $category = Category::create(['shop_category_id' => $shop->shop_category_id, 'name' => 'Products '.Str::random(4), 'slug' => 'products-'.Str::lower(Str::random(8)), 'status' => CategoryStatus::Active]);
        $product = Product::create(['shop_id' => $shop->id, 'category_id' => $category->id, 'name' => 'Private Product Name', 'slug' => 'private-'.Str::lower(Str::random(8)), 'base_sku' => 'SKU-'.Str::upper(Str::random(5)), 'price' => '100.00', 'currency' => 'PHP', 'stock_quantity' => 9, 'status' => ProductStatus::Active, 'published_at' => now()]);
        $sku = InventorySku::create(['product_id' => $product->id, 'shop_id' => $shop->id, 'code' => $product->base_sku, 'is_base' => true, 'status' => InventorySkuStatus::Active]);
        $balance = InventoryBalance::create(['inventory_sku_id' => $sku->id, 'on_hand' => 10, 'reserved' => 1]);
        $quote = CheckoutQuote::create(['customer_id' => $customer->id, 'input_payload' => [], 'request_hash' => str_repeat('a', 64), 'state_hash' => str_repeat('b', 64), 'expires_at' => now()->addHour()]);
        $batch = CheckoutBatch::create(['customer_id' => $customer->id, 'checkout_quote_id' => $quote->id, 'idempotency_key' => Str::uuid(), 'request_hash' => str_repeat('c', 64), 'currency' => 'PHP', 'placed_at' => now()]);
        $order = Order::create(['checkout_batch_id' => $batch->id, 'customer_id' => $customer->id, 'shop_id' => $shop->id, 'reference' => 'ASL-'.Str::upper(Str::random(10)), 'status' => OrderStatus::Placed, 'payment_method' => PaymentMethod::CashOnDelivery, 'payment_status' => PaymentStatus::Pending, 'currency' => 'PHP', 'merchandise_subtotal' => '100.00', 'shipping_fee' => '0.00', 'discount_total' => '0.00', 'shipping_discount_total' => '0.00', 'payable_total' => '100.00', 'placed_at' => now()]);
        $order->items()->create(['product_id' => $product->id, 'product_name' => $product->name, 'sku' => $sku->code, 'selected_options' => [], 'unit_price' => '100.00', 'quantity' => 1, 'line_subtotal' => '100.00', 'currency' => 'PHP']);
        $order->address()->create(['recipient_name' => 'Buyer', 'contact_number' => '09174444444', 'address_line_1' => '9 Buyer Street', 'barangay' => 'Lahug', 'city_municipality' => 'Cebu City', 'province' => 'Cebu', 'region' => 'Central Visayas', 'postal_code' => '6000', 'country' => 'PH']);
        $order->statusEvents()->create(['to_status' => OrderStatus::Placed, 'source' => 'customer_checkout', 'occurred_at' => now()]);
        InventoryMovement::create(['inventory_balance_id' => $balance->id, 'movement_type' => InventoryMovementType::Reserve, 'on_hand_delta' => 0, 'reserved_delta' => 1, 'resulting_on_hand' => 10, 'resulting_reserved' => 1, 'reference_type' => 'order', 'reference_id' => $order->id]);

        return $order;
    }
}
