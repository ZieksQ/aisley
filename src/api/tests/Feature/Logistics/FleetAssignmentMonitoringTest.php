<?php

namespace Tests\Feature\Logistics;

use App\Enums\UserRole;
use App\Enums\UserStatus;
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
use App\Models\User;
use App\Models\Waybill;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\Support\HubRoutingFixtures;
use Tests\TestCase;

class FleetAssignmentMonitoringTest extends TestCase
{
    use HubRoutingFixtures, RefreshDatabase;

    private const URL = '/api/v1/logistics/fleet/monitoring/assignments';

    public function test_scoped_union_has_safe_pins_and_one_record_per_assignment(): void
    {
        Http::preventStrayRequests();
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        [$first, $shipment] = $this->pickupTask($a);
        $last = $this->finalTask($a);
        $trip = $this->linehaul($a, $b);
        $this->pickupTask($b);
        $this->finalTask($b);
        $this->linehaul($b, $a);
        $before = [$first->fresh()->getAttributes(), $shipment->fresh()->getAttributes(), $trip->fresh()->getAttributes()];
        $response = $this->actingAs($a[0])->getJson(self::URL)->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')->assertJsonCount(3, 'data')->assertJsonPath('meta.total', 3);
        $rows = collect($response->json('data'))->keyBy('stage');
        $this->assertSame('first_mile:'.$first->id, $rows['first_mile']['id']);
        $this->assertSame('final_mile:'.$last->id, $rows['final_mile']['id']);
        $this->assertSame(14.5, $rows['first_mile']['stops'][0]['latitude']);
        $this->assertSame(121.1, $rows['first_mile']['stops'][0]['longitude']);
        $this->assertSame('Cora Rider', $rows['linehaul']['courier']['name']);
        $this->assertSame(14.6, $rows['final_mile']['stops'][1]['latitude']);
        $json = $response->getContent();
        foreach (['recipient_name', 'contact_number', 'address_line_1', 'email', 'qr_token_hash', 'content_checksum'] as $private) {
            $this->assertStringNotContainsString('"'.$private.'"', $json);
        }
        $this->assertSame($before, [$first->fresh()->getAttributes(), $shipment->fresh()->getAttributes(), $trip->fresh()->getAttributes()]);
        Http::assertNothingSent();
    }

    public function test_pickups_remain_until_hub_receipt_even_after_schedule_completion(): void
    {
        $a = $this->logistics();
        [$task, $shipment] = $this->pickupTask($a);
        $this->actingAs($a[0]);
        foreach (['assigned', 'accepted', 'picked_up_from_seller'] as $status) {
            $task->update(['status' => $status]);
            $shipment->update(['status' => 'picked_up_from_seller']);
            if ($status === 'picked_up_from_seller') {
                $task->schedule->update(['status' => 'completed']);
            }
            $this->getJson(self::URL)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.status', $status);
        }
        $shipment->update(['status' => 'received_at_hub', 'received_at_hub_at' => now()]);
        $this->getJson(self::URL)->assertOk()->assertJsonCount(0, 'data');
        $task->update(['status' => 'cancelled']);
        $this->getJson(self::URL)->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_last_mile_current_courier_and_current_custody_control_visibility(): void
    {
        $a = $this->logistics();
        $b = $this->logistics();
        $task = $this->finalTask($a);
        $this->actingAs($a[0]);
        foreach (['delivery_assigned', 'delivery_accepted', 'picked_up_from_hub', 'in_transit', 'out_for_delivery'] as $status) {
            $task->update(['status' => $status]);
            $task->shipment->update(['status' => $status]);
            $this->getJson(self::URL)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.status', $status);
        }
        $task->update(['status' => 'rejected', 'courier_id' => null]);
        $task->shipment->update(['status' => 'sorted_at_hub']);
        $this->getJson(self::URL)->assertOk()->assertJsonCount(0, 'data');
        $replacement = $this->courier($a[1]->id, $a[2]->id);
        $replacement->courierProfile->update(['first_name' => 'Mira']);
        $task->update(['status' => 'delivery_assigned', 'courier_id' => $replacement->id]);
        $task->shipment->update(['status' => 'delivery_assigned']);
        $this->getJson(self::URL)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.courier.name', 'Mira Rider')
            ->assertJsonPath('data.0.schedule_reference', null);
        $task->shipment->update(['current_logistics_organization_id' => $b[1]->id, 'current_hub_id' => $b[2]->id]);
        $this->getJson(self::URL)->assertOk()->assertJsonCount(0, 'data');
        $task->update(['status' => 'delivered']);
        $this->actingAs($b[0])->getJson(self::URL)->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_linehaul_keeps_owned_trucks_visible_after_work_ends(): void
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $trip = $this->linehaul($a, $b);
        $trip->update(['direction' => 'return', 'from_hub_id' => $b[2]->id, 'to_hub_id' => $a[2]->id, 'requested_by' => $b[0]->id, 'parcel_count' => 0]);
        $this->actingAs($a[0]);
        foreach (['pending_acceptance', 'scheduled', 'in_transfer', 'receiving'] as $status) {
            $trip->update(['status' => $status]);
            $this->getJson(self::URL.'?stage=linehaul')->assertOk()->assertJsonPath('data.0.direction', 'return')
                ->assertJsonPath('data.0.parcel_count', 0)->assertJsonPath('data.0.stops.0.latitude', (float) $b[2]->address->latitude);
        }
        $this->actingAs($b[0])->getJson(self::URL)->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($a[0]);
        foreach (['received', 'cancelled', 'rejected'] as $status) {
            $trip->update(['status' => $status]);
            $this->getJson(self::URL)->assertOk()->assertJsonCount(1, 'data')
                ->assertJsonPath('data.0.status', 'no_active_trip')
                ->assertJsonPath('data.0.truck.id', $trip->company_truck_id);
        }
    }

    public function test_idle_trucks_use_only_last_confirmed_pins_and_remain_searchable(): void
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $truck = CompanyTruck::create(['logistics_organization_id' => $a[1]->id,
            'home_hub_id' => $a[2]->id, 'last_confirmed_hub_id' => $b[2]->id,
            'plate_number' => 'IDLE-123', 'max_parcels' => 100]);
        $this->linehaul($b, $a);
        $this->actingAs($a[0])->getJson(self::URL.'?stage=linehaul&search=IDLE-123')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.status', 'no_active_trip')
            ->assertJsonPath('data.0.courier', null)
            ->assertJsonPath('data.0.stops.0.kind', 'last_confirmed_hub')
            ->assertJsonPath('data.0.stops.0.latitude', (float) $b[2]->address->latitude);
        $this->getJson(self::URL.'?stage=first_mile')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson(self::URL.'?search=%25')->assertOk()->assertJsonCount(0, 'data');
        $truck->update(['last_confirmed_hub_id' => null]);
        $this->getJson(self::URL.'?stage=linehaul')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.stops.0.latitude', null);
    }

    public function test_filters_stable_pagination_validation_and_unavailable_pins(): void
    {
        $a = $this->logistics();
        [$pickup] = $this->pickupTask($a);
        $last = $this->finalTask($a);
        $pickup->waybill->snapshot->update(['payload' => ['pickup' => ['latitude' => 91, 'longitude' => 121]]]);
        $this->actingAs($a[0])->getJson(self::URL.'?stage=first_mile')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.stops.0.latitude', null)->assertJsonPath('data.0.stops.0.longitude', null)
            ->assertJsonPath('data.0.stops.1.latitude', null);
        $first = $this->getJson(self::URL.'?per_page=1')->assertOk()->assertJsonPath('meta.total', 2)->assertJsonPath('meta.last_page', 2)->json('data.0.id');
        $this->getJson(self::URL.'?per_page=1')->assertJsonPath('data.0.id', $first);
        $this->assertNotSame($first, $this->getJson(self::URL.'?per_page=1&page=2')->json('data.0.id'));
        $this->getJson(self::URL.'?search=Cora')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson(self::URL.'?search='.urlencode($last->shipment->parcel->reference))->assertOk()->assertJsonCount(1, 'data');
        $this->getJson(self::URL.'?search=%25')->assertOk()->assertJsonCount(0, 'data');
        foreach (['stage=last_mile', 'page=0', 'per_page=101', 'search='.str_repeat('a', 101)] as $query) {
            $this->getJson(self::URL.'?'.$query)->assertUnprocessable();
        }
    }

    public function test_endpoint_uses_logistics_access_gates(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
        $this->actingAs(User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]))->getJson(self::URL)->assertForbidden();
        $a = $this->logistics();
        $a[0]->update(['status' => UserStatus::Suspended]);
        $this->actingAs($a[0])->getJson(self::URL)->assertForbidden();
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
