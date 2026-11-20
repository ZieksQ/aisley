<?php

namespace Tests\Feature\Courier;

use App\Enums\FirstMileTaskStatus;
use App\Enums\OrderStatus;
use App\Models\FirstMileTask;
use App\Models\InventoryBalance;
use App\Models\PickupSchedule;
use App\Services\Fulfillment\FulfillmentTransitionService;
use App\Services\Logistics\BuildPickupRouteManifest;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\Support\LocalSortingFixtures;
use Tests\TestCase;

class PickupDecisionTest extends TestCase
{
    use LocalSortingFixtures;
    use RefreshDatabase;

    public function test_three_failures_release_a_parcel_once_and_it_can_be_scheduled_again(): void
    {
        [$logistics, $courier, $schedule, $tasks] = $this->scheduled();
        $task = $tasks->sole();
        $this->actingAs($courier)->postJson($this->taskUrl($task).'/accept')->assertOk();
        $this->travelTo($schedule->starts_at);
        $key = (string) Str::uuid();
        $url = $this->taskUrl($task).'/failed-pickup';
        $body = ['reason' => 'Seller was unavailable'];
        $this->withHeader('Idempotency-Key', $key)->postJson($url, $body)->assertOk()
            ->assertJsonPath('data.failed_pickup_count', 1)->assertJsonPath('data.available_for_scheduling', false);
        $this->postJson($url, $body)->assertOk()->assertJsonPath('data.failed_pickup_count', 1);
        $this->postJson($url, ['reason' => 'Different reason'])->assertConflict();
        for ($count = 2; $count <= 3; $count++) {
            $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson($url, $body)->assertOk()
                ->assertJsonPath('data.failed_pickup_count', $count)->assertJsonPath('data.available_for_scheduling', $count === 3);
        }
        $this->assertDatabaseCount('pickup_decisions', 3);
        $this->assertDatabaseHas('first_mile_tasks', ['id' => $task->id, 'status' => 'cancelled', 'release_reason' => 'failed_pickup_limit']);
        $this->assertNull($task->order->fresh()->firstMileTask);
        $this->assertSame(OrderStatus::ReadyForPickup, $task->order->fresh()->status);
        $this->assertSame(1, InventoryBalance::sole()->reserved);
        $this->assertDatabaseCount('inventory_movements', 1);
        $this->assertDatabaseHas('pickup_schedules', ['id' => $schedule->id, 'status' => 'cancelled']);
        $this->actingAs($logistics)->getJson('/api/v1/logistics/pickups?include_orders=1&has_unscheduled=1')->assertOk()->assertJsonCount(1, 'data');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/pickup-schedules', [
            'courier_id' => $courier->id, 'order_ids' => [$task->order_id], 'starts_at' => now()->addDay()->toISOString(),
        ])->assertCreated();
        $this->assertDatabaseCount('waybills', 1);
        $this->assertDatabaseCount('first_mile_tasks', 2);
        $this->actingAs($courier)->postJson($this->taskUrl($task).'/accept')->assertConflict();
    }

    public function test_failed_parcel_can_still_be_picked_up_before_the_deadline(): void
    {
        [, $courier, $schedule, $tasks] = $this->scheduled();
        $task = $tasks->sole();
        $this->actingAs($courier)->postJson($this->taskUrl($task).'/accept')->assertOk();
        $this->travelTo($schedule->starts_at->copy()->addDay());
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson($this->taskUrl($task).'/failed-pickup', ['reason' => 'Shop closed'])->assertOk();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson($this->taskUrl($task).'/pickup', [
            'identifier_type' => 'tracking_id', 'identifier' => $task->waybill->reference,
        ])->assertOk();
        $this->assertSame(FirstMileTaskStatus::PickedUp, $task->fresh()->status);
        $this->assertDatabaseCount('courier_pickup_confirmations', 1);
    }

    public function test_reject_returns_the_entire_unaccepted_schedule_and_replays_safely(): void
    {
        [$logistics, $courier, $schedule, $tasks] = $this->scheduled(2);
        $url = "/api/v1/courier/pickup-schedules/{$schedule->id}/reject";
        $this->actingAs($courier)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson($url, ['reason' => 'Unable to take this route'])->assertOk()->assertJsonPath('data.available_for_scheduling', true);
        $this->postJson($url, ['reason' => 'Unable to take this route'])->assertOk();
        $this->assertSame(2, FirstMileTask::whereNotNull('released_at')->count());
        $this->assertDatabaseCount('pickup_decisions', 1);
        $this->assertDatabaseHas('seller_pickup_requests', ['status' => 'pending_logistics']);
        $this->assertDatabaseHas('pickup_schedule_reminders', ['pickup_schedule_id' => $schedule->id, 'status' => 'suppressed']);
        $this->actingAs($logistics)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/pickup-schedules', [
            'courier_id' => $courier->id, 'order_ids' => $tasks->pluck('order_id')->all(), 'starts_at' => now()->addDay()->toISOString(),
        ])->assertCreated();
        $this->assertDatabaseCount('waybills', 2);
    }

    public function test_deadline_releases_only_uncollected_parcels_and_receipt_completes_retained_work(): void
    {
        [$logistics, $courier, $schedule, $tasks] = $this->scheduled(2);
        $picked = $tasks->first();
        $uncollected = $tasks->last();
        $this->actingAs($courier)->postJson($this->taskUrl($picked).'/accept')->assertOk();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson($this->taskUrl($picked).'/pickup', [
            'identifier_type' => 'tracking_id', 'identifier' => $picked->waybill->reference,
        ])->assertOk();
        $this->travelTo($schedule->retryDeadline()->subSecond());
        $this->artisan('pickups:expire-schedules')->assertSuccessful();
        $this->assertNull($uncollected->fresh()->released_at);
        $this->travelTo($schedule->retryDeadline());
        $this->postJson($this->taskUrl($uncollected).'/accept')->assertConflict();
        $this->artisan('pickups:expire-schedules')->assertSuccessful();
        $this->artisan('pickups:expire-schedules')->assertSuccessful();
        $this->assertNotNull($uncollected->fresh()->released_at);
        $this->assertSame(FirstMileTaskStatus::PickedUp, $picked->fresh()->status);
        $this->assertSame('scheduled', $schedule->fresh()->status->value);
        $this->assertSame(1, DB::table('pickup_schedule_history')->where('action', 'retry_expired')->count());
        $this->actingAs($logistics)->postJson('/api/v1/logistics/receiving/batches', ['receipts' => [[
            'client_id' => (string) Str::uuid(), 'reference' => $picked->waybill->reference, 'scanned_at' => now()->toISOString(),
        ]]])->assertOk()->assertJsonPath('summary.received', 1);
        $this->assertSame('completed', $schedule->fresh()->status->value);
        $this->assertSame(OrderStatus::ReadyForPickup, $uncollected->order->fresh()->status);
    }

    public function test_expiry_cancels_a_schedule_with_no_collected_parcels(): void
    {
        [, $courier, $schedule, $tasks] = $this->scheduled();
        $this->actingAs($courier)->postJson($this->taskUrl($tasks->sole()).'/accept')->assertOk();
        $this->travelTo($schedule->retryDeadline());
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson($this->taskUrl($tasks->sole()).'/pickup', [
            'identifier_type' => 'tracking_id', 'identifier' => $tasks->sole()->waybill->reference,
        ])->assertConflict();
        $this->artisan('pickups:expire-schedules')->assertSuccessful();
        $this->assertSame('cancelled', $schedule->fresh()->status->value);
        $this->assertDatabaseCount('courier_pickup_confirmations', 0);
        $this->assertDatabaseHas('seller_pickup_requests', ['status' => 'pending_logistics']);
    }

    public function test_foreign_role_courier_and_invalid_inputs_cannot_make_decisions(): void
    {
        [$logistics, $courier, $schedule, $tasks] = $this->scheduled();
        $url = $this->taskUrl($tasks->sole()).'/failed-pickup';
        $body = ['reason' => 'Unavailable'];
        $this->actingAs($logistics)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson($url, $body)->assertForbidden();
        $foreign = $this->courier($schedule->logistics_organization_id, $schedule->logistics_hub_id);
        $this->actingAs($foreign)->postJson($url, $body)->assertNotFound();
        $this->postJson("/api/v1/courier/pickup-schedules/{$schedule->id}/reject", $body)->assertNotFound();
        $this->actingAs($courier)->withHeader('Idempotency-Key', 'bad')->postJson($url, $body)->assertUnprocessable();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson($url, ['reason' => '   '])->assertUnprocessable();
        $this->postJson($url, ['reason' => 'No', 'courier_id' => $courier->id])->assertUnprocessable();
        $this->postJson($url, $body)->assertConflict();
        $this->assertDatabaseCount('pickup_decisions', 0);
    }

    public function test_failure_before_start_and_rejection_after_acceptance_are_blocked(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-11-09T15:00:00Z'));
        [, $courier, $schedule, $tasks] = $this->scheduled();
        $task = $tasks->sole();
        $this->actingAs($courier)->postJson($this->taskUrl($task).'/accept')->assertOk();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson($this->taskUrl($task).'/failed-pickup', ['reason' => 'Not yet'])->assertConflict();
        $this->postJson("/api/v1/courier/pickup-schedules/{$schedule->id}/reject", ['reason' => 'Not available'])->assertConflict();
        $projection = $this->getJson('/api/v1/courier/first-mile-tasks')->assertOk()->json('data.0');
        $this->assertSame('2026-11-10T15:59:59.999999Z', $projection['schedule']['pickup_due_at']);
        $this->assertSame('2026-11-12T17:00:00.000000Z', $projection['schedule']['retry_deadline_at']);
        $this->assertSame(0, $projection['failed_pickup_count']);
        $this->assertNull($projection['schedule']['ends_at']);
    }

    public function test_reoffer_after_existing_projection_uses_new_courier_and_completes_the_new_schedule(): void
    {
        [$logistics, $courier, $old, $tasks] = $this->scheduled();
        $legacy = $tasks->sole();
        $shipment = app(FulfillmentTransitionService::class)->ensureForWaybill($legacy->waybill);
        $this->actingAs($courier)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/courier/pickup-schedules/{$old->id}/reject", ['reason' => 'Unavailable'])->assertOk();
        $this->assertSame('awaiting_seller_pickup', $shipment->fresh()->status->value);
        $this->assertNull($shipment->tasks()->sole()->courier_id);
        $replacement = $this->courier($old->logistics_organization_id, $old->logistics_hub_id);
        $newId = $this->actingAs($logistics)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/pickup-schedules', [
            'courier_id' => $replacement->id, 'order_ids' => [$legacy->order_id], 'starts_at' => now()->addHours(3)->toISOString(),
        ])->assertCreated()->json('data.id');
        $newTask = FirstMileTask::where('pickup_schedule_id', $newId)->sole();
        $this->actingAs($replacement)->postJson($this->taskUrl($newTask).'/accept')->assertOk();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson($this->taskUrl($newTask).'/pickup', [
            'identifier_type' => 'tracking_id', 'identifier' => $legacy->waybill->reference,
        ])->assertOk();
        $physical = $shipment->tasks()->sole();
        $this->assertSame($replacement->id, $physical->courier_id);
        $this->assertSame($newTask->id, $physical->legacy_first_mile_task_id);
        $this->actingAs($logistics)->postJson('/api/v1/logistics/receiving/batches', ['receipts' => [[
            'client_id' => (string) Str::uuid(), 'reference' => $legacy->waybill->reference, 'scanned_at' => now()->toISOString(),
        ]]])->assertOk()->assertJsonPath('summary.received', 1);
        $this->assertSame('completed', PickupSchedule::findOrFail($newId)->status->value);
        $this->assertSame('cancelled', $old->fresh()->status->value);
        $this->assertDatabaseCount('waybills', 1);
        $this->assertDatabaseCount('courier_pickup_confirmations', 1);
    }

    public function test_third_failure_releases_only_that_parcel_and_rebuilds_the_route(): void
    {
        [, $courier, $schedule, $tasks] = $this->scheduled(2);
        $failed = $tasks->first();
        $retained = $tasks->last();
        $this->actingAs($courier)->postJson($this->taskUrl($failed).'/accept')->assertOk();
        $this->travelTo($schedule->starts_at);
        for ($attempt = 1; $attempt <= 3; $attempt++) {
            $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson($this->taskUrl($failed).'/failed-pickup', ['reason' => 'Shop unavailable'])->assertOk();
        }
        $this->assertSame('scheduled', $schedule->fresh()->status->value);
        $this->assertSame(FirstMileTaskStatus::Assigned, $retained->fresh()->status);
        $this->assertDatabaseHas('seller_pickup_requests', ['status' => 'partially_scheduled']);
        $schedule->hub->address->update(['latitude' => 14.6, 'longitude' => 121.0]);
        config(['services.geoapify.server_key' => 'synthetic']);
        Http::fake(['api.geoapify.com/*' => Http::response(['sources_to_targets' => [[['distance' => 0, 'time' => 0], ['distance' => 1000, 'time' => 100]], [['distance' => 1000, 'time' => 100], ['distance' => 0, 'time' => 0]]]])]);
        $manifest = app(BuildPickupRouteManifest::class)->handle($schedule->id, $schedule->fresh()->revision);
        $routed = collect($manifest->stops)->pluck('tasks')->flatten(1)->pluck('task_id')->all();
        $this->assertNotContains($failed->id, $routed);
        $this->assertContains($retained->id, $routed);
        $this->postJson($this->taskUrl($retained).'/accept')->assertOk();
    }

    public function test_seller_request_collection_status_tracks_partial_and_complete_pickup(): void
    {
        [, $courier, $schedule, $tasks] = $this->scheduled(2);
        $seller = $tasks->first()->order->shop->seller;
        $pickupId = $tasks->first()->order->pickupRequestOrder->seller_pickup_request_id;
        $url = '/api/v1/seller/pickup-requests/'.$pickupId;
        $this->actingAs($seller)->getJson($url)->assertOk()
            ->assertJsonPath('data.status', 'scheduled')
            ->assertJsonPath('data.collection_status', null);

        foreach ($tasks as $index => $task) {
            $this->actingAs($courier)->postJson($this->taskUrl($task).'/accept')->assertOk();
            $this->withHeader('Idempotency-Key', (string) Str::uuid())
                ->postJson($this->taskUrl($task).'/pickup', [
                    'identifier_type' => 'tracking_id', 'identifier' => $task->waybill->reference,
                ])->assertOk();
            $expected = $index === 0 ? 'partially_picked_up' : 'picked_up';
            $this->actingAs($seller)->getJson($url)->assertOk()
                ->assertJsonPath('data.status', 'scheduled')
                ->assertJsonPath('data.collection_status', $expected);
            $this->getJson('/api/v1/seller/pickup-requests')->assertOk()
                ->assertJsonPath('data.0.collection_status', $expected);
        }

        // Seller collection completes before return-to-hub schedule completion.
        $this->assertSame('scheduled', $schedule->fresh()->status->value);
        [$foreignSeller] = $this->sellerShop();
        $this->actingAs($foreignSeller)->getJson($url)->assertNotFound();
        $this->getJson('/api/v1/seller/pickup-requests')->assertOk()->assertJsonCount(0, 'data');
    }

    private function scheduled(int $count = 1): array
    {
        Queue::fake();
        Http::preventStrayRequests();
        config(['services.geoapify.server_key' => null]);
        [$seller, $shop] = $this->sellerShop();
        [$logistics, $organization, $hub] = $this->logistics();
        $courier = $this->courier($organization->id, $hub->id);
        $orders = collect(range(1, $count))->map(function () use ($shop) {
            $order = $this->order($shop);
            $order->update(['status' => OrderStatus::SellerProcessing]);

            return $order;
        });
        $this->actingAs($seller)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/seller/orders/pickup-requests', [
            'order_ids' => $orders->pluck('id')->all(), 'pickup_address_id' => $seller->addresses()->sole()->id, 'logistics_organization_id' => $organization->id,
        ])->assertOk();
        $id = $this->actingAs($logistics)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/pickup-schedules', [
            'order_ids' => $orders->pluck('id')->all(), 'courier_id' => $courier->id, 'starts_at' => now()->addHours(2)->startOfSecond()->toISOString(),
        ])->assertCreated()->json('data.id');
        $schedule = PickupSchedule::findOrFail($id);

        return [$logistics, $courier, $schedule, $schedule->tasks()->with('order', 'waybill')->orderBy('id')->get()];
    }

    private function taskUrl(FirstMileTask $task): string
    {
        return "/api/v1/courier/first-mile-tasks/{$task->id}";
    }
}
