<?php

namespace Tests\Feature\Logistics;

use App\Models\CompanyTruck;
use App\Models\DeliveryTask;
use App\Models\DispatchSchedule;
use App\Models\DispatchScheduleShipment;
use App\Models\FirstMileTask;
use App\Models\LinehaulTrip;
use App\Models\Parcel;
use App\Models\PickupSchedule;
use App\Models\SellerPickupRequest;
use App\Models\Shipment;
use App\Models\Waybill;
use App\Services\Logistics\LinehaulDriverAvailability;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Support\HubRoutingFixtures;
use Tests\TestCase;

class LinehaulDriverAvailabilityTest extends TestCase
{
    use HubRoutingFixtures, RefreshDatabase;

    private function qualify($driver): void
    {
        $driver->courierLogisticsAffiliation()->update(['can_drive_company_truck' => true]);
    }

    private function driverRow(array $ctx, $driver): array
    {
        return collect($this->actingAs($ctx[0])->getJson('/api/v1/logistics/linehaul/trips')
            ->assertOk()->assertHeader('Cache-Control', 'no-store, private')->json('data.drivers'))->firstWhere('id', $driver->id);
    }

    public function test_qualified_drivers_are_sorted_available_first_and_foreign_drivers_are_hidden(): void
    {
        $a = $this->logistics();
        $b = $this->logistics();
        [$task] = $this->pickupTask($a);
        $busy = $task->courier;
        $free = $this->courier($a[1]->id, $a[2]->id);
        $foreign = $this->courier($b[1]->id, $b[2]->id);
        foreach ([$busy, $free, $foreign] as $driver) {
            $this->qualify($driver);
        }
        $busy->courierProfile->update(['first_name' => 'Aaron']);
        $free->courierProfile->update(['first_name' => 'Zara']);
        $rows = $this->actingAs($a[0])->getJson('/api/v1/logistics/linehaul/trips')->assertOk()->json('data.drivers');
        $this->assertSame([$free->id, $busy->id], array_column($rows, 'id'));
        $this->assertTrue($rows[0]['available']);
        $this->assertNull($rows[0]['operational_location']);
        $this->assertFalse($rows[1]['available']);
        $this->assertCount(1, $rows[1]['work']);
        $this->assertSame($task->schedule->reference, $rows[1]['work'][0]['reference']);
    }

    public function test_pickups_stay_busy_past_end_and_legacy_completion_until_hub_receipt(): void
    {
        $a = $this->logistics();
        [$task, $shipment] = $this->pickupTask($a);
        $this->qualify($task->courier);
        $task->schedule->update(['starts_at' => now()->subDays(2), 'ends_at' => now()->subDay()]);
        $this->assertFalse($this->driverRow($a, $task->courier)['available']);
        $task->update(['status' => 'picked_up_from_seller']);
        $task->schedule->update(['status' => 'completed']);
        $row = $this->driverRow($a, $task->courier);
        $this->assertFalse($row['available']);
        $this->assertSame('awaiting_hub_receipt', $row['work'][0]['status']);
        $this->assertStringContainsString('awaiting hub receipt', $row['operational_location']);
        $shipment->update(['received_at_hub_at' => now()]);
        $this->assertTrue($this->driverRow($a, $task->courier)['available']);
    }

    public function test_linehaul_stages_and_last_confirmed_receipt_are_honest(): void
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $trip = $this->linehaul($a, $b);
        $this->qualify($trip->driver);
        foreach (['pending_acceptance' => 'Awaiting departure', 'scheduled' => 'Awaiting departure', 'in_transfer' => 'In transit', 'receiving' => 'Receiving at'] as $status => $label) {
            $trip->update(['status' => $status]);
            $row = $this->driverRow($a, $trip->driver);
            $this->assertFalse($row['available']);
            $this->assertStringContainsString($label, $row['operational_location']);
            $this->assertSame($trip->truck->plate_number, $row['work'][0]['reference']);
        }
        $trip->update(['status' => 'in_transfer', 'courier_arrived_at' => now()]);
        $this->assertStringContainsString('not yet confirmed', $this->driverRow($a, $trip->driver)['operational_location']);
        $trip->update(['status' => 'received', 'received_at' => now()]);
        $row = $this->driverRow($a, $trip->driver);
        $this->assertTrue($row['available']);
        $this->assertStringContainsString('Last confirmed hub: '.$b[2]->name, $row['operational_location']);
        $this->assertStringContainsString('trip receipt', $row['operational_location']);
        $trip->update(['status' => 'cancelled', 'received_at' => null]);
        $this->assertNull($this->driverRow($a, $trip->driver)['operational_location']);
    }

    public function test_delivery_schedule_and_all_current_task_stages_block_assignment(): void
    {
        $a = $this->logistics();
        $task = $this->finalTask($a);
        $this->qualify($task->courier);
        foreach (['delivery_assigned', 'delivery_accepted', 'picked_up_from_hub', 'in_transit', 'out_for_delivery'] as $status) {
            $task->update(['status' => $status]);
            $row = $this->driverRow($a, $task->courier);
            $this->assertFalse($row['available']);
            $this->assertCount(1, $row['work']);
            $this->assertSame($status, $row['work'][0]['status']);
            $this->assertTrue(LinehaulDriverAvailability::workQueries([$task->courier_id])['delivery']->exists());
        }
        $task->update(['status' => 'delivered']);
        $this->assertFalse($this->driverRow($a, $task->courier)['available']);
        DispatchSchedule::query()->update(['status' => 'completed']);
        $this->assertTrue($this->driverRow($a, $task->courier)['available']);
        $task->update(['status' => 'in_transit']);
        DispatchScheduleShipment::query()->delete();
        $this->assertSame('in_transit', $this->driverRow($a, $task->courier)['work'][0]['status']);
    }

    public function test_scheduling_revalidates_busy_delivery_driver_even_without_active_schedule(): void
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $this->edge($a[2], $b[2]);
        $this->edge($b[2], $a[2]);
        $task = $this->finalTask($a);
        $this->qualify($task->courier);
        DispatchSchedule::query()->update(['status' => 'completed']);
        $truck = CompanyTruck::create(['logistics_organization_id' => $a[1]->id, 'home_hub_id' => $a[2]->id,
            'last_confirmed_hub_id' => $a[2]->id, 'plate_number' => 'BUSY-001', 'max_parcels' => 10]);
        foreach (['delivery_accepted', 'in_transit'] as $status) {
            $task->update(['status' => $status]);
            $this->actingAs($a[0])->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/linehaul/trips', [
                'next_hub_id' => $b[2]->id, 'company_truck_id' => $truck->id, 'driver_id' => $task->courier_id,
                'scheduled_for' => now()->addHour()->toISOString(), 'shipment_ids' => [$task->shipment_id],
            ])->assertConflict()->assertJsonPath('code', 'LINEHAUL_DRIVER_WORK_CONFLICT');
        }
    }

    public function test_cross_organization_work_blocks_without_disclosing_details(): void
    {
        $a = $this->logistics();
        $b = $this->logistics();
        $driver = $this->courier($a[1]->id, $a[2]->id);
        $this->qualify($driver);
        PickupSchedule::create(['logistics_organization_id' => $b[1]->id, 'logistics_hub_id' => $b[2]->id,
            'courier_id' => $driver->id, 'reference' => 'SECRET-FOREIGN', 'starts_at' => now()->addHour(),
            'revision' => 1, 'idempotency_key' => (string) Str::uuid()]);
        $trip = $this->linehaul($b, $a);
        $trip->update(['driver_id' => $driver->id]);
        $delivery = $this->finalTask($b);
        DispatchSchedule::query()->where('courier_id', $delivery->courier_id)->update(['courier_id' => $driver->id]);
        $delivery->update(['courier_id' => $driver->id]);
        $row = $this->driverRow($a, $driver);
        $this->assertFalse($row['available']);
        $this->assertCount(3, $row['work']);
        foreach ($row['work'] as $work) {
            $this->assertSame('other', $work['type']);
            $this->assertNull($work['reference']);
            $this->assertNull($work['route']);
        }
        $this->assertSame('other', $row['work'][0]['type']);
        $this->assertNull($row['work'][0]['reference']);
        $this->assertNull($row['work'][0]['scheduled_for']);
        $this->assertNull($row['operational_location']);
        $this->assertStringNotContainsString('SECRET', json_encode($row));
    }

    public function test_multiple_work_types_are_reported_without_duplicate_pickup_rows(): void
    {
        $a = $this->logistics();
        $b = $this->logistics();
        [$task] = $this->pickupTask($a);
        $trip = $this->linehaul($a, $b);
        $trip->update(['driver_id' => $task->courier_id]);
        $this->qualify($task->courier);
        $row = $this->driverRow($a, $task->courier);
        $this->assertFalse($row['available']);
        $this->assertCount(2, $row['work']);
        $this->assertSame(['linehaul', 'pickup'], array_column($row['work'], 'type'));
    }

    private function pickupTask(array $ctx): array
    {
        [$seller, $shop] = $this->sellerShop();
        $order = $this->order($shop);
        $order->update(['status' => 'ready_for_pickup']);
        $courier = $this->courier($ctx[1]->id, $ctx[2]->id);
        $request = SellerPickupRequest::create(['shop_id' => $shop->id, 'seller_id' => $seller->id, 'logistics_organization_id' => $ctx[1]->id, 'logistics_hub_id' => $ctx[2]->id, 'idempotency_key' => (string) Str::uuid()]);
        $waybill = Waybill::create(['order_id' => $order->id, 'seller_pickup_request_id' => $request->id, 'shop_id' => $shop->id,
            'logistics_organization_id' => $ctx[1]->id, 'logistics_hub_id' => $ctx[2]->id, 'reference' => 'WB-'.Str::random(12),
            'qr_token_hash' => hash('sha256', Str::random()), 'content_checksum' => str_repeat('a', 64)]);
        $waybill->snapshot()->create(['payload' => ['pickup' => ['latitude' => 14.5, 'longitude' => 121.1, 'barangay' => 'Poblacion', 'city_municipality' => 'Manila']]]);
        $schedule = PickupSchedule::create(['logistics_organization_id' => $ctx[1]->id, 'logistics_hub_id' => $ctx[2]->id,
            'courier_id' => $courier->id, 'reference' => 'PS-'.Str::random(12), 'starts_at' => now()->addHour(), 'ends_at' => now()->addHours(2), 'revision' => 1, 'idempotency_key' => (string) Str::uuid()]);
        $task = FirstMileTask::create(['pickup_schedule_id' => $schedule->id, 'order_id' => $order->id, 'waybill_id' => $waybill->id,
            'logistics_organization_id' => $ctx[1]->id, 'logistics_hub_id' => $ctx[2]->id, 'courier_id' => $courier->id, 'status' => 'assigned']);
        $parcel = Parcel::create(['order_id' => $order->id, 'waybill_id' => $waybill->id, 'reference' => $waybill->reference, 'snapshot' => []]);
        $shipment = Shipment::create(['parcel_id' => $parcel->id, 'logistics_organization_id' => $ctx[1]->id, 'logistics_hub_id' => $ctx[2]->id, 'status' => 'seller_pickup_assigned']);
        DeliveryTask::create(['shipment_id' => $shipment->id, 'leg' => 'first_mile', 'status' => 'seller_pickup_assigned', 'courier_id' => $courier->id, 'legacy_first_mile_task_id' => $task->id]);

        return [$task, $shipment];
    }

    private function finalTask(array $ctx): DeliveryTask
    {
        [$first, $shipment] = $this->pickupTask($ctx);
        $first->update(['status' => 'picked_up_from_seller']);
        $first->schedule->update(['status' => 'completed']);
        $shipment->update(['status' => 'delivery_assigned', 'received_at_hub_at' => now()]);
        $shipment->parcel->order->address->update(['latitude' => 14.6, 'longitude' => 121.2]);
        $task = DeliveryTask::create(['shipment_id' => $shipment->id, 'leg' => 'final_mile', 'status' => 'delivery_assigned', 'courier_id' => $first->courier_id]);
        $schedule = DispatchSchedule::create(['logistics_organization_id' => $ctx[1]->id, 'logistics_hub_id' => $ctx[2]->id, 'courier_id' => $first->courier_id,
            'created_by_logistics_id' => $ctx[0]->id, 'reference' => 'DS-'.Str::random(12), 'scheduled_for' => now()->addHour(), 'status' => 'scheduled', 'parcel_count' => 1,
            'revision' => 1, 'idempotency_key' => (string) Str::uuid(), 'request_hash' => str_repeat('a', 64)]);
        DispatchScheduleShipment::create(['dispatch_schedule_id' => $schedule->id, 'shipment_id' => $shipment->id, 'delivery_task_id' => $task->id, 'sequence' => 1]);

        return $task;
    }

    private function linehaul(array $a, array $b): LinehaulTrip
    {
        $truck = CompanyTruck::create(['logistics_organization_id' => $a[1]->id, 'home_hub_id' => $a[2]->id, 'plate_number' => 'TRK-'.Str::random(8), 'max_parcels' => 100]);
        $driver = $this->courier($a[1]->id, $a[2]->id);

        return LinehaulTrip::create(['owner_logistics_organization_id' => $a[1]->id, 'home_hub_id' => $a[2]->id,
            'from_hub_id' => $a[2]->id, 'to_hub_id' => $b[2]->id, 'company_truck_id' => $truck->id, 'driver_id' => $driver->id,
            'requested_by' => $a[0]->id, 'direction' => 'outbound', 'status' => 'scheduled', 'scheduled_for' => now()->addHour(),
            'capacity_snapshot' => 100, 'parcel_count' => 10, 'idempotency_key' => (string) Str::uuid(), 'request_hash' => str_repeat('a', 64)]);
    }
}
