<?php

namespace Tests\Feature\Logistics;

use App\Models\CompanyTruck;
use App\Models\FirstMileTask;
use App\Models\PickupSchedule;
use App\Models\PickupScheduleHistory;
use App\Models\Shipment;
use App\Services\Fulfillment\FulfillmentTransitionService;
use App\Services\Logistics\PickupScheduleLifecycleService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\Support\HubRoutingFixtures;
use Tests\TestCase;

class CourierScheduleConflictTest extends TestCase
{
    use HubRoutingFixtures {
        sellerShop as private unpinnedSellerShop;
    }
    use RefreshDatabase;

    private function sellerShop(): array
    {
        [$seller, $shop] = $this->unpinnedSellerShop();
        $seller->addresses()->update(['latitude' => 14.6, 'longitude' => 121.0]);

        return [$seller, $shop];
    }

    private function collectParcel($courier, string $reference): void
    {
        $task = FirstMileTask::whereHas('waybill', fn ($q) => $q->where('reference', $reference))->sole();
        $this->actingAs($courier)->getJson('/api/v1/courier/first-mile-tasks')->assertOk();
        $this->postJson('/api/v1/courier/first-mile-tasks/'.$task->id.'/accept')->assertOk();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/courier/first-mile-tasks/'.$task->id.'/pickup', ['identifier_type' => 'tracking_id', 'identifier' => $reference])->assertOk();
    }

    private function receiveParcel($logistics, string $reference): void
    {
        $receipt = ['client_id' => (string) Str::uuid(), 'reference' => $reference, 'scanned_at' => now()->toISOString()];
        $this->actingAs($logistics)->postJson('/api/v1/logistics/receiving/batches', ['receipts' => [$receipt]])->assertOk()->assertJsonPath('summary.received', 1);
        $this->postJson('/api/v1/logistics/receiving/batches', ['receipts' => [$receipt]])->assertOk();
    }

    public function test_pickups_reserve_courier_until_every_parcel_reaches_hub(): void
    {
        Queue::fake();
        $a = $this->pinnedHub();
        [$order, $reference] = $this->pickupAt($a);
        [$second, $secondReference] = $this->pickupAt($a);
        [$next] = $this->pickupAt($a);
        $courier = $this->courier($a[1]->id, $a[2]->id);
        $body = ['order_ids' => [$order->id, $second->id], 'courier_id' => $courier->id, 'starts_at' => now()->addHours(3)->toISOString()];
        $key = (string) Str::uuid();
        $schedule = $this->actingAs($a[0])->withHeader('Idempotency-Key', $key)->postJson('/api/v1/logistics/pickup-schedules', $body)->assertCreated()->assertJsonPath('data.ends_at', null)->json('data');
        $this->postJson('/api/v1/logistics/pickup-schedules', $body)->assertCreated()->assertJsonPath('data.id', $schedule['id']);
        $this->postJson('/api/v1/logistics/pickup-schedules', [...$body, 'starts_at' => now()->addHours(2)->toISOString()])->assertConflict();
        $this->patchJson('/api/v1/logistics/pickup-schedules/'.$schedule['id'], [
            'expected_revision' => 1, 'reason' => 'Adjust collection time', 'starts_at' => now()->addHours(4)->toISOString(),
        ])->assertOk()->assertJsonPath('data.ends_at', null)->assertJsonPath('data.revision', 2);
        $this->actingAs($courier)->getJson('/api/v1/courier/first-mile-tasks')->assertOk()->assertJsonPath('data.0.schedule.ends_at', null);
        $this->getJson('/api/v1/courier/pickup-schedules/'.$schedule['id'].'/route-manifest')->assertOk()->assertJsonPath('data.schedule.ends_at', null);
        $this->collectParcel($courier, $reference);
        $this->collectParcel($courier, $secondReference);
        $record = PickupSchedule::findOrFail($schedule['id']);
        $this->assertSame('scheduled', $record->status->value);
        $this->assertFalse(app(PickupScheduleLifecycleService::class)->completeIfReady($record, $courier->id));
        $availability = '/api/v1/logistics/pickup-couriers?'.http_build_query(['starts_at' => now()->addDays(2)->toISOString()]);
        $this->actingAs($a[0])->getJson($availability)->assertOk()->assertJsonPath('data.0.availability', 'scheduled');
        $nextBody = ['order_ids' => [$next->id], 'courier_id' => $courier->id, 'starts_at' => now()->addDays(2)->toISOString()];
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/pickup-schedules', $nextBody)->assertConflict()->assertJsonPath('code', 'COURIER_SCHEDULE_CONFLICT');
        $shipment = Shipment::whereHas('parcel.waybill', fn ($q) => $q->where('reference', $reference))->sole();
        app(FulfillmentTransitionService::class)->transitionLogistics($a[0], [
            'reference' => $reference, 'target_state' => 'received_at_hub', 'expected_revision' => $shipment->revision,
        ], (string) Str::uuid());
        $this->assertSame('scheduled', $record->fresh()->status->value);
        $this->receiveParcel($a[0], $secondReference);
        $this->assertSame('completed', $record->fresh()->status->value);
        $this->assertDatabaseHas('pickup_schedule_reminders', ['pickup_schedule_id' => $record->id, 'status' => 'suppressed']);
        $this->assertSame(1, PickupScheduleHistory::where('pickup_schedule_id', $record->id)->where('action', 'completed')->count());
        $this->getJson($availability)->assertOk()->assertJsonPath('data.0.availability', 'available');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/pickup-schedules', $nextBody)->assertCreated();
    }

    public function test_linehaul_blocks_expired_and_legacy_completed_pickups_until_hub_receipt(): void
    {
        Queue::fake();
        Http::fake(['api.geoapify.com/*' => Http::response(['sources_to_targets' => [[['distance' => 10000, 'time' => 1000]]]])]);
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $this->edge($a[2], $b[2]);
        $this->edge($b[2], $a[2]);
        $this->area($b[2]);
        [, $cargo] = $this->pickupAt($a);
        $this->receiveOrigin($a, $cargo);
        $this->sortFor($a, $cargo, $b[2]->id);
        [$order, $reference] = $this->pickupAt($a);
        $driver = $this->courier($a[1]->id, $a[2]->id);
        $driver->courierLogisticsAffiliation()->update(['can_drive_company_truck' => true]);
        $truck = CompanyTruck::create(['logistics_organization_id' => $a[1]->id, 'home_hub_id' => $a[2]->id, 'last_confirmed_hub_id' => $a[2]->id, 'plate_number' => 'BUG-001', 'max_parcels' => 10]);
        $schedule = $this->actingAs($a[0])->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/pickup-schedules', [
            'order_ids' => [$order->id], 'courier_id' => $driver->id, 'starts_at' => now()->addHour()->toISOString(), 'ends_at' => now()->addHours(2)->toISOString(),
        ])->assertCreated()->json('data');
        PickupSchedule::whereKey($schedule['id'])->update(['starts_at' => now()->subHours(2), 'ends_at' => now()->subHour()]);
        $tripBody = ['next_hub_id' => $b[2]->id, 'company_truck_id' => $truck->id, 'driver_id' => $driver->id, 'scheduled_for' => now()->addHour()->toISOString(), 'shipment_ids' => [Shipment::whereHas('parcel.waybill', fn ($q) => $q->where('reference', $cargo))->sole()->id]];
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/linehaul/trips', $tripBody)->assertConflict()->assertJsonPath('code', 'LINEHAUL_DRIVER_WORK_CONFLICT');
        $this->collectParcel($driver, $reference);
        PickupSchedule::whereKey($schedule['id'])->update(['status' => 'completed']);
        $this->actingAs($a[0])->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/linehaul/trips', $tripBody)->assertConflict()->assertJsonPath('code', 'LINEHAUL_DRIVER_WORK_CONFLICT');
        $this->receiveParcel($a[0], $reference);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/linehaul/trips', $tripBody)->assertCreated();
        $this->getJson('/api/v1/logistics/pickup-couriers?'.http_build_query(['starts_at' => now()->addDays(2)->toISOString()]))->assertOk()->assertJsonPath('data.1.availability', 'scheduled');
    }
}
