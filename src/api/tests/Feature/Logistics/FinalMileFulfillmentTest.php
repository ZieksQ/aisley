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
use App\Models\Category;
use App\Models\CheckoutBatch;
use App\Models\CheckoutQuote;
use App\Models\DeliveryTask;
use App\Models\FirstMileTask;
use App\Models\InventoryBalance;
use App\Models\InventoryMovement;
use App\Models\InventorySku;
use App\Models\Order;
use App\Models\Product;
use App\Models\Shipment;
use App\Models\ShipmentEvent;
use App\Models\Shop;
use App\Models\ShopCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class FinalMileFulfillmentTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // This suite exercises historical route-less local fulfillment fixtures.
        config(['hub-routing.enabled' => false]);
    }

    use RefreshDatabase;

    public function test_offline_receiving_sorting_and_dispatch_schedule_assign_delivery_courier(): void
    {
        [$seller, $shop] = $this->sellerShop();
        $order = $this->order($shop);
        $order->update(['status' => OrderStatus::SellerProcessing]);
        [$logistics, $organization, $hub] = $this->logistics();
        $courier = $this->courier($organization->id, $hub->id);
        $pickup = $this->actingAs($seller)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/seller/orders/pickup-requests', [
            'order_ids' => [$order->id], 'pickup_address_id' => $seller->addresses()->sole()->id, 'logistics_organization_id' => $organization->id,
        ])->assertOk()->json('data');
        $this->actingAs($logistics)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/pickup-schedules', [
            'order_ids' => [$order->id], 'courier_id' => $courier->id, 'starts_at' => now()->addHours(3)->toISOString(), 'ends_at' => now()->addHours(4)->toISOString(),
        ])->assertCreated();
        $first = $this->actingAs($courier)->getJson('/api/v1/courier/first-mile-tasks')->assertOk()->json('data.0');
        $this->postJson("/api/v1/courier/first-mile-tasks/{$first['id']}/accept")->assertOk();
        $reference = $pickup['waybills'][0]['reference'];
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/courier/first-mile-tasks/{$first['id']}/pickup", [
            'identifier_type' => 'tracking_id', 'identifier' => $reference,
        ])->assertOk();

        $receiptId = (string) Str::uuid();
        $this->actingAs($logistics)->postJson('/api/v1/logistics/receiving/batches', ['receipts' => [[
            'client_id' => $receiptId, 'reference' => $reference, 'scanned_at' => now()->subMinute()->toISOString(),
        ]]])->assertOk()->assertJsonPath('summary.received', 1)->assertJsonPath('data.0.status', 'received');
        $this->postJson('/api/v1/logistics/receiving/batches', ['receipts' => [[
            'client_id' => $receiptId, 'reference' => $reference, 'scanned_at' => now()->subMinute()->toISOString(),
        ]]])->assertOk()->assertJsonPath('summary.received', 1);

        $lane = $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'CEB-01', 'name' => 'Cebu staging', 'type' => 'standard'])
            ->assertCreated()->assertJsonPath('data.code', 'CEB-01')->json('data');
        $this->get('/api/v1/logistics/sorting/lanes/'.$lane['id'].'/label')->assertOk()->assertHeader('Content-Type', 'image/svg+xml; charset=UTF-8');
        $session = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/sessions')
            ->assertCreated()->assertJsonPath('data.expected_count', 1)->json('data');
        $sortId = (string) Str::uuid();
        $sortCapturedAt = now()->toISOString();
        $this->postJson("/api/v1/logistics/sorting/sessions/{$session['id']}/batches", ['captures' => [[
            'client_id' => $sortId, 'lane_id' => $lane['id'], 'reference' => $reference,
            'expected_revision' => $session['items'][0]['expected_revision'], 'source' => 'barcode', 'captured_at' => $sortCapturedAt,
        ]]])->assertOk()->assertJsonPath('summary.sorted', 1)->assertJsonPath('data.0.status', 'sorted');
        $this->postJson("/api/v1/logistics/sorting/sessions/{$session['id']}/batches", ['captures' => [[
            'client_id' => $sortId, 'lane_id' => $lane['id'], 'reference' => $reference,
            'expected_revision' => $session['items'][0]['expected_revision'], 'source' => 'barcode', 'captured_at' => $sortCapturedAt,
        ]]])->assertOk()->assertJsonPath('summary.sorted', 1)->assertJsonPath('data.0.status', 'sorted');
        $overview = $this->getJson('/api/v1/logistics/sorting')->assertOk()->assertJsonPath('data.session.counts.sorted', 1)->json('data');
        $this->postJson("/api/v1/logistics/sorting/sessions/{$session['id']}/close", ['expected_revision' => $overview['session']['revision']])
            ->assertOk()->assertJsonPath('data.status', 'closed');
        $record = $this->getJson('/api/v1/logistics/update-status/records/'.$reference)->assertOk()->assertJsonPath('data.status', 'sorted_at_hub')->json('data');
        $this->assertDatabaseHas('shipment_events', ['shipment_id' => $record['shipment_id'], 'event_type' => 'hub_sort', 'recorded_by_logistics_id' => $logistics->id]);

        $this->getJson('/api/v1/logistics/dispatch/couriers')->assertOk()->assertJsonPath('data.0.contact_number', '09173333333');
        $dispatchKey = (string) Str::uuid();
        $schedule = $this->withHeader('Idempotency-Key', $dispatchKey)->postJson('/api/v1/logistics/dispatch/schedules', [
            'shipment_ids' => [$record['shipment_id']], 'courier_id' => $courier->id, 'scheduled_for' => now()->addHour()->toISOString(),
            'assignments' => [['shipment_id' => $record['shipment_id'], 'expected_revision' => $record['revision'], 'lane_id' => $lane['id'], 'lane_revision' => $lane['revision']]],
        ])->assertCreated()->assertJsonPath('data.parcel_count', 1)->assertJsonPath('data.courier.contact_number', '09173333333')->json('data');
        $this->assertDatabaseHas('dispatch_schedules', ['id' => $schedule['id'], 'parcel_count' => 1, 'status' => 'scheduled']);
        $this->assertSame(OrderStatus::Assigned, $order->fresh()->status);
        $this->actingAs($order->customer)->getJson('/api/v1/customer/orders/'.$order->id)
            ->assertOk()->assertJsonPath('data.statusLabel', 'Scheduled for delivery')
            ->assertJsonPath('data.delivery.courier.name', 'Cora Rider')
            ->assertJsonPath('data.delivery.courier.contactNumber', '09173333333');

        $tooMany = array_map(fn () => (string) Str::uuid(), range(1, 16));
        $this->actingAs($logistics)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/dispatch/schedules', [
            'shipment_ids' => $tooMany, 'courier_id' => $courier->id, 'scheduled_for' => now()->addHour()->toISOString(),
        ])->assertStatus(422)->assertJsonValidationErrors('shipment_ids');
    }

    public function test_sorting_exception_requires_resolution_and_is_tenant_scoped(): void
    {
        [$seller, $shop] = $this->sellerShop();
        $order = $this->order($shop);
        $order->update(['status' => OrderStatus::SellerProcessing]);
        [$logistics, $organization, $hub] = $this->logistics();
        $courier = $this->courier($organization->id, $hub->id);
        $pickup = $this->actingAs($seller)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/seller/orders/pickup-requests', [
            'order_ids' => [$order->id], 'pickup_address_id' => $seller->addresses()->sole()->id, 'logistics_organization_id' => $organization->id,
        ])->assertOk()->json('data');
        $this->actingAs($logistics)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/pickup-schedules', [
            'order_ids' => [$order->id], 'courier_id' => $courier->id, 'starts_at' => now()->addHours(3)->toISOString(), 'ends_at' => now()->addHours(4)->toISOString(),
        ])->assertCreated();
        $first = $this->actingAs($courier)->getJson('/api/v1/courier/first-mile-tasks')->assertOk()->json('data.0');
        $this->postJson("/api/v1/courier/first-mile-tasks/{$first['id']}/accept")->assertOk();
        $reference = $pickup['waybills'][0]['reference'];
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/courier/first-mile-tasks/{$first['id']}/pickup", [
            'identifier_type' => 'qr', 'identifier' => 'AISLEY:WB:1:'.$reference,
        ])->assertOk();
        $this->actingAs($logistics)->postJson('/api/v1/logistics/receiving/batches', ['receipts' => [[
            'client_id' => (string) Str::uuid(), 'reference' => $reference, 'scanned_at' => now()->toISOString(),
        ]]])->assertOk()->assertJsonPath('summary.received', 1);

        $standard = $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'STD-01', 'name' => 'Standard staging', 'type' => 'standard'])->assertCreated()->json('data');
        $exception = $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'EX-01', 'name' => 'Needs review', 'type' => 'exception'])->assertCreated()->json('data');
        $session = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/sessions')->assertCreated()->json('data');
        $item = $session['items'][0];
        $exceptionCapture = [
            'client_id' => (string) Str::uuid(), 'lane_id' => $exception['id'], 'reference' => $reference,
            'expected_revision' => $item['expected_revision'], 'source' => 'manual', 'captured_at' => now()->toISOString(),
            'exception_code' => 'damaged', 'reason' => 'Outer packaging needs review.',
        ];
        $this->postJson("/api/v1/logistics/sorting/sessions/{$session['id']}/batches", ['captures' => [$exceptionCapture]])
            ->assertOk()->assertJsonPath('summary.exception', 1)->assertJsonPath('data.0.status', 'exception');
        $this->getJson('/api/v1/logistics/update-status/records/'.$reference)->assertOk()->assertJsonPath('data.status', 'received_at_hub');
        $overview = $this->getJson('/api/v1/logistics/sorting')->assertOk()->assertJsonPath('data.session.counts.exception', 1)->json('data');
        $this->postJson("/api/v1/logistics/sorting/sessions/{$session['id']}/close", ['expected_revision' => $overview['session']['revision']])
            ->assertConflict()->assertJsonPath('code', 'SORT_SESSION_UNRESOLVED');

        $this->postJson("/api/v1/logistics/sorting/sessions/{$session['id']}/batches", ['captures' => [[
            'client_id' => (string) Str::uuid(), 'lane_id' => $standard['id'], 'reference' => $reference,
            'expected_revision' => $item['expected_revision'], 'source' => 'barcode', 'captured_at' => now()->toISOString(),
        ]]])->assertOk()->assertJsonPath('summary.sorted', 1);
        $overview = $this->getJson('/api/v1/logistics/sorting')->assertOk()->assertJsonPath('data.session.counts.sorted', 1)->json('data');
        $this->postJson("/api/v1/logistics/sorting/sessions/{$session['id']}/close", ['expected_revision' => $overview['session']['revision']])->assertOk();
        $this->postJson("/api/v1/logistics/sorting/sessions/{$session['id']}/batches", ['captures' => [[
            'client_id' => (string) Str::uuid(), 'lane_id' => $standard['id'], 'reference' => $reference,
            'expected_revision' => $item['expected_revision'], 'source' => 'barcode', 'captured_at' => now()->toISOString(),
        ]]])->assertOk()->assertJsonPath('data.0.code', 'SORT_SESSION_CLOSED');

        [$otherLogistics] = $this->logistics();
        $this->actingAs($otherLogistics)->getJson('/api/v1/logistics/sorting')->assertOk()->assertJsonCount(0, 'data.lanes');
        $this->get('/api/v1/logistics/sorting/lanes/'.$standard['id'].'/label')->assertNotFound();
        $this->patchJson('/api/v1/logistics/sorting/lanes/'.$standard['id'], ['expected_revision' => $standard['revision'], 'is_active' => false])->assertNotFound();
    }

    public function test_final_mile_moves_from_hub_to_delivered_with_logistics_validation(): void
    {
        [$seller, $shop] = $this->sellerShop();
        $order = $this->order($shop);
        $order->update(['status' => OrderStatus::SellerProcessing]);
        [$logistics, $organization, $hub] = $this->logistics();
        $courier = $this->courier($organization->id, $hub->id);
        $pickupAddress = $seller->addresses()->sole();
        $pickup = $this->actingAs($seller)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/seller/orders/pickup-requests', [
            'order_ids' => [$order->id], 'pickup_address_id' => $pickupAddress->id, 'logistics_organization_id' => $organization->id,
        ])->assertOk()->json('data');
        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $logistics->id,
            'type' => 'logistics-pickup.requested',
        ]);
        $schedule = $this->actingAs($logistics)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/pickup-schedules', [
            'order_ids' => [$order->id], 'courier_id' => $courier->id, 'starts_at' => now()->addHours(3)->toISOString(), 'ends_at' => now()->addHours(4)->toISOString(),
        ])->assertCreated()->json('data');
        $first = $this->actingAs($courier)->getJson('/api/v1/courier/first-mile-tasks')->assertOk()->json('data.0');
        $this->postJson("/api/v1/courier/first-mile-tasks/{$first['id']}/accept")->assertOk();
        $qr = 'AISLEY:WB:1:'.$pickup['waybills'][0]['reference'];
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/courier/first-mile-tasks/{$first['id']}/pickup", ['identifier_type' => 'qr', 'identifier' => $qr])->assertOk();

        $record = $this->actingAs($logistics)->getJson('/api/v1/logistics/update-status/records/'.$pickup['waybills'][0]['reference'])->assertOk()->json('data');
        $this->assertSame('picked_up_from_seller', $record['status']);
        $this->actingAs($logistics)
            ->getJson('/api/v1/logistics/dashboard/queue?search='.$pickup['waybills'][0]['reference'])
            ->assertOk()
            ->assertJsonPath('freshness.state', 'authoritative')
            ->assertJsonPath('summary.total', 1)
            ->assertJsonPath('data.0.shipment_id', $record['shipment_id']);
        $this->actingAs($logistics)->getJson('/api/v1/logistics/dashboard/queue?per_page=26')->assertStatus(422);
        [$otherLogistics] = $this->logistics();
        $this->actingAs($otherLogistics)
            ->getJson('/api/v1/logistics/dashboard/queue')
            ->assertOk()
            ->assertJsonPath('summary.total', 0)
            ->assertJsonCount(0, 'data');
        $this->actingAs($logistics);
        $this->postJson('/api/v1/logistics/receiving/batches', ['receipts' => [[
            'client_id' => (string) Str::uuid(), 'reference' => $pickup['waybills'][0]['reference'], 'scanned_at' => now()->toISOString(),
        ]]])->assertOk()->assertJsonPath('summary.received', 1);
        $record = $this->getJson('/api/v1/logistics/update-status/records/'.$pickup['waybills'][0]['reference'])->json('data');
        $record = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/update-status/transitions', [
            'reference' => $pickup['waybills'][0]['reference'], 'target_state' => 'sorted_at_hub', 'expected_revision' => $record['revision'],
        ])->assertOk()->json('data');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/dispatch/schedules', [
            'shipment_ids' => [$record['shipment_id']], 'courier_id' => $courier->id, 'scheduled_for' => now()->addHour()->toISOString(),
        ])->assertCreated();
        $record = $this->getJson('/api/v1/logistics/update-status/records/'.$pickup['waybills'][0]['reference'])->json('data');
        $final = collect($record['tasks'])->firstWhere('leg', 'final_mile');
        $this->assertSame('delivery_assigned', $final['status']);

        $this->actingAs($logistics)->getJson("/api/v1/logistics/deploy-rider/tasks/{$final['task_id']}/candidates")->assertOk()->assertJsonPath('data.0.courier_id', $courier->id);
        $this->actingAs($courier)->getJson("/api/v1/courier/tasks/{$final['task_id']}/delivery")->assertStatus(409)->assertJsonPath('code', 'TASK_NOT_ACCEPTED');
        $rejected = $this->actingAs($courier)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/courier/final-mile-tasks/{$final['task_id']}/reject", [
            'reason' => 'Unavailable for this route',
        ])->assertOk()->json('data');
        $this->assertSame('rejected', $rejected['status']);
        $this->assertNull($rejected['courier_id']);
        $this->assertSame('rejected', $rejected['offer']['status']);
        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $logistics->id,
            'type' => 'logistics-task.offer-rejected',
        ]);
        $offer = $this->actingAs($logistics)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/logistics/deploy-rider/tasks/{$final['task_id']}/offers", [
            'courier_id' => $courier->id, 'expected_task_revision' => $rejected['revision'],
        ])->assertCreated()->json('data');
        $this->assertSame(2, $offer['offer']['sequence']);
        $this->assertCount(2, $offer['task']['offer_history']);
        $this->assertSame('rejected', $offer['task']['offer_history'][0]['status']);
        $this->assertSame('Unavailable for this route', $offer['task']['offer_history'][0]['rejection_reason']);
        $final = $offer['task'];
        $this->actingAs($courier)->postJson("/api/v1/courier/final-mile-tasks/{$final['task_id']}/accept")->assertOk();
        $final = $this->actingAs($courier)->getJson('/api/v1/courier/final-mile-tasks')->assertOk()->json('data.0');
        $this->actingAs($courier)->getJson("/api/v1/courier/tasks/{$final['task_id']}/delivery")
            ->assertOk()
            ->assertJsonPath('data.status', 'delivery_accepted')
            ->assertJsonPath('data.destination.address_line_1', '9 Buyer Street')
            ->assertJsonPath('data.destination.contact_number', '09174444444');
        $pickupEvidence = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/courier/final-mile-tasks/{$final['task_id']}/pickup", [
            'identifier_type' => 'tracking_id', 'identifier' => $pickup['waybills'][0]['reference'], 'expected_revision' => $final['revision'],
        ])->assertStatus(202)->json('data');
        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $logistics->id,
            'type' => 'logistics-evidence.submitted',
        ]);
        $record = $this->actingAs($logistics)->getJson('/api/v1/logistics/update-status/records/'.$pickup['waybills'][0]['reference'])->json('data');
        $record = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/update-status/transitions', [
            'reference' => $pickup['waybills'][0]['reference'], 'target_state' => 'picked_up_from_hub', 'expected_revision' => $record['revision'], 'evidence_id' => $pickupEvidence['evidence_id'],
        ])->assertOk()->json('data');
        $final = collect($record['tasks'])->firstWhere('leg', 'final_mile');

        foreach (['in_transit', 'out_for_delivery'] as $state) {
            $final = $this->actingAs($courier)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/courier/final-mile-tasks/{$final['task_id']}/status", ['target_state' => $state, 'expected_revision' => $final['revision']])->assertOk()->json('data');
        }
        $proof = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/courier/tasks/{$final['task_id']}/proof-of-delivery", ['identifier_type' => 'qr', 'identifier' => $qr, 'expected_revision' => $final['revision']])->assertStatus(202)->json('data');
        $intent = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/courier/tasks/{$final['task_id']}/completion", ['expected_revision' => $final['revision'], 'evidence_id' => $proof['proof_id'], 'confirmed' => true])->assertStatus(202)->json('data');
        $this->assertSame('awaiting_validation', $intent['completion_status']);
        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $logistics->id,
            'type' => 'logistics-completion.requested',
        ]);
        $record = $this->actingAs($logistics)->getJson('/api/v1/logistics/update-status/records/'.$pickup['waybills'][0]['reference'])->json('data');
        $queuedFinal = collect($record['tasks'])->firstWhere('leg', 'final_mile');
        $this->assertSame('awaiting_validation', collect($queuedFinal['evidence'])->firstWhere('id', $proof['proof_id'])['status']);
        $this->assertSame('awaiting_validation', $queuedFinal['completion_intents'][0]['status']);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/update-status/transitions', [
            'reference' => $pickup['waybills'][0]['reference'], 'target_state' => 'delivered', 'expected_revision' => $record['revision'], 'evidence_id' => $proof['proof_id'],
        ])->assertOk()->assertJsonPath('data.status', 'delivered');
        $this->assertSame(OrderStatus::Delivered, $order->fresh()->status);
        $this->assertDatabaseHas('shipment_events', ['event_type' => 'delivery_completed', 'performing_courier_id' => $courier->id, 'recorded_by_logistics_id' => $logistics->id]);
        $this->actingAs($courier)->getJson('/api/v1/courier/delivery-history')->assertOk()->assertJsonPath('data.0.status', 'delivered');
    }

    public function test_lane_moves_are_idempotent_scoped_and_preserve_dispatch_provenance(): void
    {
        [$logistics, $courier, $references] = $this->receivedParcels(1);
        $a = $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'LANE-A', 'name' => 'Lane A', 'type' => 'standard'])->assertCreated()->json('data');
        $b = $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'LANE-B', 'name' => 'Lane B', 'type' => 'standard'])->assertCreated()->json('data');
        $session = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/sessions')->assertCreated()->json('data');
        $this->postJson("/api/v1/logistics/sorting/sessions/{$session['id']}/batches", ['captures' => [[
            'client_id' => (string) Str::uuid(), 'lane_id' => $a['id'], 'reference' => $references[0], 'expected_revision' => $session['items'][0]['expected_revision'], 'source' => 'manual', 'captured_at' => now()->toISOString(),
        ]]])->assertOk()->assertJsonPath('summary.sorted', 1);
        $record = $this->getJson('/api/v1/logistics/update-status/records/'.$references[0])->assertOk()->json('data');
        $this->postJson('/api/v1/logistics/dispatch/schedules', ['shipment_ids' => [$record['shipment_id']], 'courier_id' => $courier->id, 'scheduled_for' => now()->addHour()->toISOString()])->assertConflict()->assertJsonPath('code', 'DISPATCH_ASSIGNMENT_REQUIRED');
        $this->postJson("/api/v1/logistics/sorting/sessions/{$session['id']}/close", ['expected_revision' => $session['revision']])->assertOk();
        $this->patchJson('/api/v1/logistics/sorting/lanes/'.$a['id'], ['expected_revision' => 1, 'is_active' => false])->assertConflict()->assertJsonPath('code', 'SORT_LANE_IN_USE');
        $move = ['lane_id' => $b['id'], 'expected_revision' => $record['revision'], 'expected_lane_revision' => 1, 'reason' => 'Consolidate staging'];
        [$foreign] = $this->logistics();
        $this->actingAs($foreign)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/shipments/'.$record['shipment_id'].'/move', $move)->assertNotFound();
        $foreignLane = $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'FOREIGN-01', 'name' => 'Foreign lane', 'type' => 'standard'])->assertCreated()->json('data');
        $this->actingAs($logistics)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/shipments/'.$record['shipment_id'].'/move', [...$move, 'lane_id' => $foreignLane['id']])->assertNotFound();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/shipments/'.$record['shipment_id'].'/move', [...$move, 'expected_lane_revision' => 2])->assertConflict();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/shipments/'.$record['shipment_id'].'/move', [...$move, 'lane_id' => $a['id']])->assertConflict()->assertJsonPath('code', 'SORT_MOVE_SAME_LANE');
        $hold = $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'HOLD-MOVE', 'name' => 'Hold lane', 'type' => 'exception'])->assertCreated()->json('data');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/shipments/'.$record['shipment_id'].'/move', [...$move, 'lane_id' => $hold['id']])->assertConflict()->assertJsonPath('code', 'SORT_LANE_NOT_STANDARD');
        $key = (string) Str::uuid();
        $moved = $this->actingAs($logistics)->withHeader('Idempotency-Key', $key)->postJson('/api/v1/logistics/sorting/shipments/'.$record['shipment_id'].'/move', $move)->assertOk()->assertJsonPath('data.status', 'sorted_at_hub')->assertJsonPath('data.sorting_lane.id', $b['id'])->json('data');
        $this->assertSame($record['revision'] + 1, $moved['revision']);
        $this->assertDatabaseHas('sorting_session_items', ['id' => $session['items'][0]['id'], 'sorting_lane_id' => $a['id']]);
        $this->postJson('/api/v1/logistics/sorting/shipments/'.$record['shipment_id'].'/move', $move)->assertOk()->assertJsonPath('data.revision', $moved['revision']);
        $this->postJson('/api/v1/logistics/sorting/shipments/'.$record['shipment_id'].'/move', [...$move, 'reason' => 'Different operation'])->assertConflict()->assertJsonPath('code', 'IDEMPOTENCY_KEY_REUSED');
        $this->assertSame(1, ShipmentEvent::where('shipment_id', $record['shipment_id'])->where('event_type', 'hub_lane_move')->count());
        $input = ['shipment_ids' => [$record['shipment_id']], 'courier_id' => $courier->id, 'scheduled_for' => now()->addHour()->toISOString(), 'assignments' => [$this->dispatchAssignment($record)]];
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/dispatch/schedules', $input)->assertConflict()->assertJsonPath('code', 'DISPATCH_ASSIGNMENT_CONFLICT');
        $input['assignments'] = [$this->dispatchAssignment($moved)];
        $dispatchKey = (string) Str::uuid();
        $schedule = $this->withHeader('Idempotency-Key', $dispatchKey)->postJson('/api/v1/logistics/dispatch/schedules', $input)->assertCreated()->assertJsonPath('data.parcels.0.source_lane.code', 'LANE-B')->assertJsonPath('data.parcels.0.sorting_session_id', $session['id'])->json('data');
        $this->postJson('/api/v1/logistics/dispatch/schedules', $input)->assertCreated()->assertJsonPath('data.id', $schedule['id']);
        $this->patchJson('/api/v1/logistics/sorting/lanes/'.$b['id'], ['expected_revision' => 1, 'code' => 'RENAMED-B', 'name' => 'Renamed lane'])->assertOk();
        $this->patchJson('/api/v1/logistics/sorting/lanes/'.$b['id'], ['expected_revision' => 2, 'is_active' => false])->assertConflict()->assertJsonPath('code', 'SORT_LANE_IN_USE');
        $this->getJson('/api/v1/logistics/dispatch/schedules')->assertOk()->assertJsonPath('data.0.parcels.0.source_lane.code', 'LANE-B');
        $assigned = $this->getJson('/api/v1/logistics/update-status/records/'.$references[0])->json('data');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/shipments/'.$record['shipment_id'].'/move', ['lane_id' => $a['id'], 'expected_revision' => $assigned['revision'], 'expected_lane_revision' => 1, 'reason' => 'Too late to move'])->assertConflict()->assertJsonPath('code', 'SORT_MOVE_STATE_CONFLICT');
        $task = collect($assigned['tasks'])->firstWhere('leg', 'final_mile');
        $accepted = $this->actingAs($courier)->postJson("/api/v1/courier/final-mile-tasks/{$task['task_id']}/accept")->assertOk()->json('data');
        $evidence = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/courier/final-mile-tasks/{$task['task_id']}/pickup", ['identifier_type' => 'qr', 'identifier' => 'AISLEY:WB:1:'.$references[0], 'expected_revision' => $accepted['revision']])->assertStatus(202)->json('data');
        $record = $this->actingAs($logistics)->getJson('/api/v1/logistics/update-status/records/'.$references[0])->assertOk()->json('data');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/update-status/transitions', ['reference' => $references[0], 'target_state' => 'picked_up_from_hub', 'expected_revision' => $record['revision'], 'evidence_id' => $evidence['evidence_id']])->assertOk()->assertJsonPath('data.sorting_lane', null);
        $this->patchJson('/api/v1/logistics/sorting/lanes/'.$b['id'], ['expected_revision' => 2, 'is_active' => false])->assertOk();
        $this->getJson('/api/v1/logistics/dispatch/schedules')->assertOk()->assertJsonPath('data.0.parcels.0.source_lane.code', 'LANE-B');
    }

    public function test_mixed_lane_dispatch_is_explicit_atomic_and_does_not_wait_for_exception_session(): void
    {
        [$logistics, $courier, $references] = $this->receivedParcels(3);
        $a = $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'A-01', 'name' => 'Lane A', 'type' => 'standard'])->json('data');
        $b = $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'B-01', 'name' => 'Lane B', 'type' => 'standard'])->json('data');
        $hold = $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'HOLD-01', 'name' => 'Review', 'type' => 'exception'])->json('data');
        $session = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/sessions')->assertCreated()->json('data');
        $items = collect($session['items'])->keyBy('reference');
        foreach ($references as $index => $reference) {
            $capture = ['client_id' => (string) Str::uuid(), 'lane_id' => [$a['id'], $b['id'], $hold['id']][$index], 'reference' => $reference, 'expected_revision' => $items[$reference]['expected_revision'], 'source' => 'manual', 'captured_at' => now()->toISOString()];
            if ($index === 2) {
                $capture['exception_code'] = 'damaged';
            }
            $this->postJson("/api/v1/logistics/sorting/sessions/{$session['id']}/batches", ['captures' => [$capture]])->assertOk()->assertJsonPath($index === 2 ? 'summary.exception' : 'summary.sorted', 1);
        }
        $records = array_map(fn ($reference) => $this->getJson('/api/v1/logistics/update-status/records/'.$reference)->assertOk()->json('data'), $references);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/update-status/transitions', ['reference' => $references[2], 'target_state' => 'sorted_at_hub', 'expected_revision' => $records[2]['revision']])->assertConflict()->assertJsonPath('code', 'SORT_EXCEPTION_HOLD');
        $input = ['shipment_ids' => array_column(array_slice($records, 0, 2), 'shipment_id'), 'courier_id' => $courier->id, 'scheduled_for' => now()->addHour()->toISOString(), 'assignments' => array_map($this->dispatchAssignment(...), array_slice($records, 0, 2))];
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/dispatch/schedules', $input)->assertConflict()->assertJsonPath('code', 'DISPATCH_MIXED_LANES');
        $this->assertDatabaseCount('dispatch_schedules', 0);
        $this->getJson('/api/v1/logistics/dashboard/queue?status=sorted_at_hub&lane_id='.$a['id'])->assertOk()->assertJsonCount(1, 'data')->assertJsonCount(2, 'summary.by_lane');
        $invalid = [...$input, 'combine_lanes' => true, 'shipment_ids' => array_column($records, 'shipment_id'), 'assignments' => array_map($this->dispatchAssignment(...), $records)];
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/dispatch/schedules', $invalid)->assertConflict()->assertJsonPath('code', 'DISPATCH_STATE_CONFLICT');
        $this->assertDatabaseCount('dispatch_schedules', 0);
        $this->assertDatabaseCount('dispatch_schedule_shipments', 0);
        $this->postJson("/api/v1/logistics/sorting/sessions/{$session['id']}/close", ['expected_revision' => $session['revision']])->assertConflict();
        $blockedTask = DeliveryTask::create(['shipment_id' => $records[1]['shipment_id'], 'logistics_organization_id' => $logistics->logisticsOrganization->id, 'logistics_hub_id' => $logistics->logisticsOrganization->hub->id, 'leg' => 'final_mile', 'status' => 'delivery_accepted', 'revision' => 1]);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/dispatch/schedules', [...$input, 'combine_lanes' => true])->assertConflict()->assertJsonPath('code', 'TASK_STATE_CONFLICT');
        $this->assertDatabaseCount('dispatch_schedules', 0);
        $this->assertDatabaseCount('dispatch_schedule_shipments', 0);
        $this->assertSame(0, ShipmentEvent::where('to_state', 'dispatched_from_hub')->count());
        $this->assertDatabaseHas('shipments', ['id' => $records[0]['shipment_id'], 'status' => 'sorted_at_hub', 'revision' => $records[0]['revision']]);
        $blockedTask->delete();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/dispatch/schedules', [...$input, 'combine_lanes' => true])->assertCreated()->assertJsonPath('data.parcels.0.source_lane.code', 'A-01')->assertJsonPath('data.parcels.1.source_lane.code', 'B-01');
        $this->getJson('/api/v1/logistics/sorting')->assertOk()->assertJsonPath('data.session.status', 'open')->assertJsonPath('data.session.counts.exception', 1)->assertJsonPath('data.session.items.0.can_move', false);
        $this->assertDatabaseCount('dispatch_schedule_shipments', 2);
        $this->assertDatabaseHas('shipments', ['id' => $records[2]['shipment_id'], 'status' => 'received_at_hub']);
    }

    public function test_session_and_dispatch_order_use_receipt_time_instead_of_mutation_time(): void
    {
        [, , $references] = $this->receivedParcels(2);
        $records = array_map(fn ($reference) => $this->getJson('/api/v1/logistics/update-status/records/'.$reference)->json('data'), $references);
        Shipment::whereKey($records[0]['shipment_id'])->update(['received_at_hub_at' => now()->subDays(2), 'updated_at' => now()]);
        Shipment::whereKey($records[1]['shipment_id'])->update(['received_at_hub_at' => now()->subDay(), 'updated_at' => now()->subDay()]);
        $lane = $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'FIFO-01', 'name' => 'Receipt order', 'type' => 'standard'])->json('data');
        $session = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/sessions')->assertCreated()->assertJsonPath('data.items.0.reference', $references[0])->json('data');
        foreach (array_reverse($session['items']) as $item) {
            $this->postJson("/api/v1/logistics/sorting/sessions/{$session['id']}/batches", ['captures' => [['client_id' => (string) Str::uuid(), 'lane_id' => $lane['id'], 'reference' => $item['reference'], 'expected_revision' => $item['expected_revision'], 'source' => 'manual', 'captured_at' => now()->toISOString()]]])->assertOk()->assertJsonPath('summary.sorted', 1);
        }
        $this->getJson('/api/v1/logistics/dashboard/queue?status=sorted_at_hub')->assertOk()->assertJsonPath('data.0.shipment_id', $records[0]['shipment_id']);
    }

    public function test_legacy_lane_less_dispatch_remains_explicitly_unassigned(): void
    {
        [, $courier, $references] = $this->receivedParcels(1);
        $record = $this->getJson('/api/v1/logistics/update-status/records/'.$references[0])->json('data');
        $sorted = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/update-status/transitions', ['reference' => $references[0], 'target_state' => 'sorted_at_hub', 'expected_revision' => $record['revision']])->assertOk()->json('data');
        $this->getJson('/api/v1/logistics/dashboard/queue?status=sorted_at_hub&lane_id=unassigned')->assertOk()->assertJsonPath('data.0.shipment_id', $sorted['shipment_id'])->assertJsonPath('summary.by_lane.0.code', null);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/dispatch/schedules', ['shipment_ids' => [$sorted['shipment_id']], 'courier_id' => $courier->id, 'scheduled_for' => now()->addHour()->toISOString()])->assertCreated()->assertJsonPath('data.parcels.0.source_lane', null);
    }

    public function test_additive_lane_migration_backfills_receipt_assignment_and_marked_history(): void
    {
        [, $courier, $references] = $this->receivedParcels(1);
        $lane = $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'BRIDGE-01', 'name' => 'Existing lane', 'type' => 'standard'])->json('data');
        $session = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/sessions')->json('data');
        $this->postJson("/api/v1/logistics/sorting/sessions/{$session['id']}/batches", ['captures' => [['client_id' => (string) Str::uuid(), 'lane_id' => $lane['id'], 'reference' => $references[0], 'expected_revision' => $session['items'][0]['expected_revision'], 'source' => 'manual', 'captured_at' => now()->toISOString()]]])->assertOk()->assertJsonPath('summary.sorted', 1);
        $record = $this->getJson('/api/v1/logistics/update-status/records/'.$references[0])->json('data');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/dispatch/schedules', ['shipment_ids' => [$record['shipment_id']], 'courier_id' => $courier->id, 'scheduled_for' => now()->addHour()->toISOString(), 'assignments' => [$this->dispatchAssignment($record)]])->assertCreated();
        $migration = require database_path('migrations/2026_09_16_000001_add_shipment_lane_assignments.php');
        // SQLite rebuilds the referenced table on DROP COLUMN; defer checks until it is restored.
        DB::statement('PRAGMA defer_foreign_keys = ON');
        $migration->down();
        $migration->up();
        $this->assertSame([], DB::select('PRAGMA foreign_key_check'));
        $this->getJson('/api/v1/logistics/update-status/records/'.$references[0])->assertOk()->assertJsonPath('data.sorting_lane.id', $lane['id'])->assertJsonPath('data.received_at_hub_at', $record['received_at_hub_at']);
        $this->getJson('/api/v1/logistics/dispatch/schedules')->assertOk()->assertJsonPath('data.0.parcels.0.source_lane.historical_backfill', true)->assertJsonPath('data.0.parcels.0.source_lane.code', 'BRIDGE-01')->assertJsonPath('data.0.parcels.0.shipment_revision_at_dispatch', null);
    }

    public function test_automatic_sort_plan_routing_matches_postal_code_and_falls_back_to_exception_lane(): void
    {
        [, , $references] = $this->receivedParcels(2);
        $standard = $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'AUTO-01', 'name' => 'Automatic standard', 'type' => 'standard'])->assertCreated()->json('data');
        $exception = $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'AUTO-EX', 'name' => 'Automatic exceptions', 'type' => 'exception'])->assertCreated()->json('data');
        $session = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/sessions')->assertCreated()->json('data');
        $items = collect($session['items'])->keyBy('reference');

        $fallback = $this->postJson("/api/v1/logistics/sorting/sessions/{$session['id']}/batches", ['captures' => [[
            'client_id' => (string) Str::uuid(), 'lane_id' => null, 'auto_route' => true, 'reference' => $references[0],
            'expected_revision' => $items[$references[0]]['expected_revision'], 'source' => 'barcode', 'captured_at' => now()->toISOString(),
        ]]])->assertOk()
            ->assertJsonPath('summary.exception', 1)
            ->assertJsonPath('data.0.status', 'exception')
            ->assertJsonPath('data.0.automatic', true)
            ->assertJsonPath('data.0.sort_plan_id', null)
            ->assertJsonPath('data.0.lane.code', 'AUTO-EX')
            ->json('data.0');
        $this->assertDatabaseHas('sorting_scans', ['client_id' => $fallback['client_id'], 'automatic_routing' => true, 'sorting_plan_id' => null, 'sorting_lane_id' => $exception['id']]);
        $this->assertDatabaseHas('sorting_session_items', ['sorting_session_id' => $session['id'], 'shipment_id' => Shipment::query()->whereHas('parcel.waybill', fn ($query) => $query->where('reference', $references[0]))->value('id'), 'sorting_lane_id' => $exception['id'], 'status' => 'exception']);

        $plan = $this->postJson('/api/v1/logistics/sorting/plans', ['name' => 'Cebu postal routing', 'is_active' => true])->assertCreated()->json('data');
        $mapping = $this->postJson("/api/v1/logistics/sorting/plans/{$plan['id']}/lanes", [
            'expected_revision' => $plan['revision'], 'lane_id' => $standard['id'], 'postal_code' => '6000',
        ])->assertOk()->assertJsonPath('data.lanes.0.postal_code', '6000')->json('data.lanes.0');
        $matched = $this->postJson("/api/v1/logistics/sorting/sessions/{$session['id']}/batches", ['captures' => [[
            'client_id' => (string) Str::uuid(), 'lane_id' => null, 'auto_route' => true, 'reference' => $references[1],
            'expected_revision' => $items[$references[1]]['expected_revision'], 'source' => 'barcode', 'captured_at' => now()->toISOString(),
        ]]])->assertOk()
            ->assertJsonPath('summary.sorted', 1)
            ->assertJsonPath('data.0.status', 'sorted')
            ->assertJsonPath('data.0.automatic', true)
            ->assertJsonPath('data.0.sort_plan_id', $plan['id'])
            ->assertJsonPath('data.0.sort_plan_lane_id', $mapping['id'])
            ->assertJsonPath('data.0.lane.code', 'AUTO-01')
            ->json('data.0');
        $this->assertDatabaseHas('sorting_scans', ['client_id' => $matched['client_id'], 'automatic_routing' => true, 'sorting_plan_id' => $plan['id'], 'sorting_plan_lane_id' => $mapping['id'], 'sorting_lane_id' => $standard['id']]);
        $this->getJson('/api/v1/logistics/sorting')->assertOk()
            ->assertJsonPath('data.automatic_sorting.active_plan.id', $plan['id'])
            ->assertJsonPath('data.session.counts.exception', 1)
            ->assertJsonPath('data.session.counts.sorted', 1);
    }

    private function dispatchAssignment(array $record): array
    {
        return ['shipment_id' => $record['shipment_id'], 'expected_revision' => $record['revision'], 'lane_id' => $record['sorting_lane']['id'] ?? null, 'lane_revision' => $record['sorting_lane']['revision'] ?? null];
    }

    private function receivedParcels(int $count): array
    {
        [$seller, $shop] = $this->sellerShop();
        [$logistics, $organization, $hub] = $this->logistics();
        $courier = $this->courier($organization->id, $hub->id);
        $orders = collect(range(1, $count))->map(function () use ($shop) {
            $order = $this->order($shop);
            $order->update(['status' => OrderStatus::SellerProcessing]);

            return $order;
        });
        $pickup = $this->actingAs($seller)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/seller/orders/pickup-requests', ['order_ids' => $orders->pluck('id')->all(), 'pickup_address_id' => $seller->addresses()->sole()->id, 'logistics_organization_id' => $organization->id])->assertOk()->json('data');
        $this->actingAs($logistics)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/pickup-schedules', ['order_ids' => $orders->pluck('id')->all(), 'courier_id' => $courier->id, 'starts_at' => now()->addHours(3)->toISOString(), 'ends_at' => now()->addHours(4)->toISOString()])->assertCreated();
        $tasks = $this->actingAs($courier)->getJson('/api/v1/courier/first-mile-tasks')->assertOk()->json('data');
        foreach ($tasks as $task) {
            $this->postJson("/api/v1/courier/first-mile-tasks/{$task['id']}/accept")->assertOk();
            $waybill = FirstMileTask::findOrFail($task['id'])->waybill;
            $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/courier/first-mile-tasks/{$task['id']}/pickup", ['identifier_type' => 'qr', 'identifier' => 'AISLEY:WB:1:'.$waybill->reference])->assertOk();
        }
        $references = array_column($pickup['waybills'], 'reference');
        $this->actingAs($logistics)->postJson('/api/v1/logistics/receiving/batches', ['receipts' => array_map(fn ($reference) => ['client_id' => (string) Str::uuid(), 'reference' => $reference, 'scanned_at' => now()->toISOString()], $references)])->assertOk()->assertJsonPath('summary.received', $count);

        return [$logistics, $courier, $references];
    }

    private function sellerShop(): array
    {
        $seller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
        $category = ShopCategory::create(['name' => 'General '.Str::random(5), 'slug' => 'general-'.Str::lower(Str::random(8)), 'status' => CategoryStatus::Active]);
        $shop = Shop::create(['seller_id' => $seller->id, 'shop_category_id' => $category->id, 'name' => 'Seller Shop', 'slug' => 'seller-'.Str::lower(Str::random(8)), 'status' => ShopStatus::Active, 'contact_number' => '09171111111']);
        $seller->addresses()->create(['type' => AddressType::Both, 'label' => 'Pickup', 'recipient_name' => 'Seller', 'contact_number' => '09171111111', 'address_line_1' => '1 Seller Road', 'barangay' => 'Ermita', 'city_municipality' => 'Manila', 'province' => 'Metro Manila', 'region' => 'NCR', 'postal_code' => '1000', 'country' => 'PH', 'is_default' => true]);

        return [$seller, $shop];
    }

    private function logistics(): array
    {
        $user = User::factory()->create(['role' => UserRole::Logistics, 'status' => UserStatus::Active]);
        $address = $user->addresses()->create(['type' => AddressType::Both, 'label' => 'Hub', 'recipient_name' => 'Operator', 'contact_number' => '09172222222', 'address_line_1' => '1 Hub Road', 'barangay' => 'Poblacion', 'city_municipality' => 'Manila', 'province' => 'Metro Manila', 'region' => 'NCR', 'postal_code' => '1000', 'country' => 'PH', 'is_default' => true]);
        $organization = $user->logisticsOrganization()->create(['business_name' => 'Aisley Logistics']);
        $hub = $organization->hub()->create(['address_id' => $address->id, 'name' => 'Aisley Hub']);

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
        $product = Product::create(['shop_id' => $shop->id, 'category_id' => $category->id, 'name' => 'Product', 'slug' => 'product-'.Str::lower(Str::random(8)), 'base_sku' => 'SKU-'.Str::upper(Str::random(5)), 'price' => '100.00', 'currency' => 'PHP', 'stock_quantity' => 9, 'status' => ProductStatus::Active, 'published_at' => now()]);
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
