<?php

namespace Tests\Feature\Logistics;

use App\Models\CompanyTruck;
use App\Models\Shipment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\Support\HubRoutingFixtures;
use Tests\TestCase;

class CompanyTruckLinehaulTest extends TestCase
{
    use HubRoutingFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.geoapify.server_key' => 'test-key']);
        Http::preventStrayRequests();
        Http::fake(['api.geoapify.com/v1/routematrix*' => Http::response(['sources_to_targets' => [[['distance' => 1000, 'time' => 100]]]])]);
    }

    public function test_capacity_approval_receipt_and_empty_return_flow(): void
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $foreign = $this->pinnedHub();
        $this->edge($a[2], $b[2]);
        $this->edge($b[2], $a[2]);
        $this->area($b[2]);

        $references = [];
        for ($i = 0; $i < 3; $i++) {
            [, $references[]] = $this->pickupAt($a);
        }
        foreach ($references as $reference) {
            $this->receiveOrigin($a, $reference);
        }
        $this->sortFor($a, $references[0], $b[2]->id);
        $session = $this->getJson('/api/v1/logistics/sorting')->json('data.session');
        $alternateLane = $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'ALT', 'name' => 'Alternate staging', 'type' => 'standard'])->assertCreated()->json('data');
        $alternatePlan = $this->postJson('/api/v1/logistics/sorting/plans', ['name' => 'Alternate route plan', 'is_active' => true])->assertCreated()->json('data');
        $this->postJson('/api/v1/logistics/sorting/plans/'.$alternatePlan['id'].'/lanes', [
            'expected_revision' => $alternatePlan['revision'], 'lane_id' => $alternateLane['id'],
            'destination_type' => 'hub', 'destination_hub_id' => $b[2]->id,
        ])->assertOk();
        foreach (array_slice($references, 1) as $reference) {
            $item = collect($session['items'])->first(fn ($item) => $item['reference'] === $reference);
            $this->postJson('/api/v1/logistics/sorting/sessions/'.$session['id'].'/batches', ['captures' => [[
                'client_id' => (string) Str::uuid(), 'auto_route' => true, 'reference' => $reference,
                'expected_revision' => $item['expected_revision'], 'source' => 'manual', 'captured_at' => now()->toISOString(),
            ]]])->assertOk();
        }
        $shipments = Shipment::query()->whereHas('parcel.waybill', fn ($query) => $query->whereIn('reference', $references))
            ->with('parcel.waybill')->get()->keyBy(fn (Shipment $shipment) => $shipment->parcel->waybill->reference);
        $selectedShipmentIds = [$shipments->get($references[0])->id, $shipments->get($references[1])->id];

        $driver = $this->courier($a[1]->id, $a[2]->id);
        $this->actingAs($a[0])->patchJson('/api/v1/logistics/fleet/drivers/'.$driver->id, [
            'can_drive_company_truck' => true, 'expected_revision' => 1,
        ])->assertOk();
        $truck = $this->postJson('/api/v1/logistics/fleet/trucks', [
            'plate_number' => 'CAP-200', 'make' => 'Isuzu', 'model' => 'N-Series', 'max_parcels' => 2,
        ])->assertCreated()->assertJsonPath('data.max_parcels', 2)->json('data');
        $this->actingAs($foreign[0])->patchJson('/api/v1/logistics/fleet/trucks/'.$truck['id'], [
            'expected_revision' => 1, 'max_parcels' => 3,
        ])->assertNotFound();

        $scheduled = now()->addHour()->startOfMinute()->toISOString();
        $this->actingAs($a[0])->getJson('/api/v1/logistics/linehaul/trips')->assertOk()
            ->assertJsonCount(2, 'data.ready_groups.0.lane_groups');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/linehaul/trips', [
            'next_hub_id' => $b[2]->id, 'company_truck_id' => $truck['id'], 'driver_id' => $driver->id, 'scheduled_for' => $scheduled,
            'shipment_ids' => $shipments->pluck('id')->values()->all(),
        ])->assertUnprocessable()->assertJsonPath('code', 'LINEHAUL_CAPACITY_EXCEEDED');
        $trip = $this->actingAs($a[0])->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/linehaul/trips', [
            'next_hub_id' => $b[2]->id, 'company_truck_id' => $truck['id'], 'driver_id' => $driver->id, 'scheduled_for' => $scheduled,
            'shipment_ids' => $selectedShipmentIds,
        ])->assertCreated()->assertJsonPath('data.parcel_count', 2)->assertJsonPath('data.remaining_capacity', 0)->json('data');
        $this->getJson('/api/v1/logistics/linehaul')->assertOk()->assertJsonCount(1, 'data.ready_groups.0.references');
        $this->postJson('/api/v1/logistics/linehaul/trips/'.$trip['id'].'/depart', ['expected_revision' => 1])
            ->assertConflict()->assertJsonPath('code', 'LINEHAUL_TRIP_CHANGED');
        [$seller, $shop] = $this->sellerShop();
        $conflictingOrder = $this->order($shop);
        $conflictingOrder->update(['status' => 'seller_processing']);
        $this->actingAs($seller)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/seller/orders/pickup-requests', [
            'order_ids' => [$conflictingOrder->id], 'pickup_address_id' => $seller->addresses()->sole()->id, 'logistics_organization_id' => $a[1]->id,
        ])->assertOk()->json('data');
        $this->actingAs($a[0])->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/pickup-schedules', [
            'order_ids' => [$conflictingOrder->id], 'courier_id' => $driver->id, 'starts_at' => now()->addHours(3)->toISOString(), 'ends_at' => now()->addHours(4)->toISOString(),
        ])->assertConflict()->assertJsonPath('code', 'COURIER_SCHEDULE_CONFLICT');

        $this->actingAs($b[0])->getJson('/api/v1/logistics/linehaul/trips')->assertOk()->assertJsonPath('data.inbound.0.can_decide', true);
        $this->postJson('/api/v1/logistics/linehaul/trips/'.$trip['id'].'/decision', ['accept' => true, 'expected_revision' => 1])->assertOk();
        $this->actingAs($a[0])->postJson('/api/v1/logistics/linehaul/trips/'.$trip['id'].'/depart', ['expected_revision' => 2])
            ->assertOk()->assertJsonPath('data.status', 'in_transfer');
        $this->assertSame(2, Shipment::query()->where('status', 'in_transfer')->count());
        $this->actingAs($b[0]);
        $this->receiveTripParcels($trip['id']);
        $this->assertDatabaseHas('company_trucks', ['id' => $truck['id'], 'logistics_organization_id' => $a[1]->id, 'availability' => 'visiting', 'last_confirmed_hub_id' => $b[2]->id]);

        $return = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/linehaul/trips/'.$trip['id'].'/return', [
            'scheduled_for' => now()->addHours(2)->startOfMinute()->toISOString(), 'empty_return' => true,
        ])->assertCreated()->assertJsonPath('data.status', 'scheduled')->assertJsonPath('data.empty_return', true)->json('data');
        $this->assertDatabaseHas('notifications', ['notifiable_id' => $a[0]->id, 'type' => 'logistics-linehaul.return-scheduled']);
        $this->assertDatabaseHas('notifications', ['notifiable_id' => $driver->id, 'type' => 'courier-linehaul.trip-scheduled']);
        $this->actingAs($foreign[0])->postJson('/api/v1/logistics/linehaul/trips/'.$return['id'].'/depart', ['expected_revision' => 1])->assertNotFound();
        $this->actingAs($b[0])->postJson('/api/v1/logistics/linehaul/trips/'.$return['id'].'/depart', ['expected_revision' => 1])->assertOk();
        $this->actingAs($a[0])->postJson('/api/v1/logistics/linehaul/trips/'.$return['id'].'/receive', ['expected_revision' => 2])->assertOk();
        $this->assertDatabaseHas('company_trucks', ['id' => $truck['id'], 'logistics_organization_id' => $a[1]->id, 'availability' => 'available', 'last_confirmed_hub_id' => $a[2]->id]);
        $this->actingAs($driver)->getJson('/api/v1/courier/linehaul-trips')->assertOk()->assertJsonCount(2, 'data');
        $this->assertDatabaseCount('linehaul_manifests', 1);
    }

    public function test_rejection_releases_capacity_and_non_truck_driver_is_rejected(): void
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $this->edge($a[2], $b[2]);
        $this->edge($b[2], $a[2]);
        $this->area($b[2]);
        [, $reference] = $this->pickupAt($a);
        $this->receiveOrigin($a, $reference);
        $this->sortFor($a, $reference, $b[2]->id);
        $driver = $this->courier($a[1]->id, $a[2]->id);
        $truck = CompanyTruck::create([
            'logistics_organization_id' => $a[1]->id, 'home_hub_id' => $a[2]->id, 'last_confirmed_hub_id' => $a[2]->id,
            'plate_number' => 'REJ-100', 'max_parcels' => 1,
        ]);
        $shipmentId = Shipment::whereHas('parcel.waybill', fn ($query) => $query->where('reference', $reference))->sole()->id;
        $body = ['next_hub_id' => $b[2]->id, 'company_truck_id' => $truck->id, 'driver_id' => $driver->id, 'scheduled_for' => now()->addHour()->toISOString(), 'shipment_ids' => [$shipmentId]];
        $this->actingAs($a[0])->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/linehaul/trips', $body)
            ->assertUnprocessable()->assertJsonPath('code', 'LINEHAUL_DRIVER_NOT_ELIGIBLE');
        $driver->courierLogisticsAffiliation()->update(['can_drive_company_truck' => true]);
        $trip = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/linehaul/trips', $body)->assertCreated()->json('data');
        $this->actingAs($b[0])->postJson('/api/v1/logistics/linehaul/trips/'.$trip['id'].'/decision', ['accept' => false, 'reason' => 'Dock unavailable', 'expected_revision' => 1])->assertOk();
        $this->assertDatabaseHas('company_trucks', ['id' => $truck->id, 'availability' => 'available']);
        $this->assertDatabaseHas('linehaul_trip_shipments', ['linehaul_trip_id' => $trip['id']]);
        $this->assertNotNull(DB::table('linehaul_trip_shipments')->where('linehaul_trip_id', $trip['id'])->value('released_at'));
        $this->actingAs($a[0])->getJson('/api/v1/logistics/linehaul')->assertOk()->assertJsonCount(1, 'data.ready_groups.0.references');
    }
}
