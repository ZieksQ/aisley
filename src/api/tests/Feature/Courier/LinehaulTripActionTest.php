<?php

namespace Tests\Feature\Courier;

use App\Models\CompanyTruck;
use App\Models\LinehaulTrip;
use App\Models\PlatformFeatureControl;
use App\Models\Shipment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\Support\HubRoutingFixtures;
use Tests\TestCase;

class LinehaulTripActionTest extends TestCase
{
    use HubRoutingFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.geoapify.server_key' => 'synthetic-key']);
        Http::preventStrayRequests();
        Http::fake(['api.geoapify.com/v1/routematrix*' => Http::response(['sources_to_targets' => [[['distance' => 1000, 'time' => 100]]]])]);
    }

    public function test_release_driver_departure_arrival_and_independent_receiving(): void
    {
        [$a, $b, $driver, $trip, $shipment, $truck] = $this->scheduledTrip();
        $this->actingAs($driver)->postJson($this->url($trip, 'depart'), $this->body(2))->assertConflict()->assertJsonPath('code', 'LINEHAUL_RELEASE_REQUIRED');
        $this->actingAs($b[0])->postJson($this->releaseUrl($trip), $this->body(2))->assertNotFound();
        $released = $this->actingAs($a[0])->postJson($this->releaseUrl($trip), $this->body(2))->assertOk()->assertJsonPath('data.status', 'scheduled')->assertJsonPath('data.revision', 3)->json('data');
        $this->postJson($this->releaseUrl($trip), $this->body(2))->assertOk()->assertJsonPath('data.released_for_departure_at', $released['released_for_departure_at']);
        $this->assertDatabaseCount('linehaul_manifests', 0);
        $this->assertSame('sorted_at_hub', $shipment->fresh()->status->value);

        $this->app['auth']->forgetGuards();
        $this->withToken($driver->createToken('test-phone', ['courier'])->plainTextToken);
        $departed = $this->postJson($this->url($trip, 'depart'), $this->body(3))->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.status', 'in_transfer')->assertJsonPath('data.departed_by', $driver->id)
            ->assertJsonPath('data.courier_can_report_arrival', true)->json('data');
        $this->postJson($this->url($trip, 'depart'), $this->body(3))->assertOk()->assertJsonPath('data.departed_at', $departed['departed_at']);
        $this->assertDatabaseCount('linehaul_manifests', 1);
        $this->assertDatabaseHas('linehaul_manifests', ['created_by' => $a[0]->id]);
        $this->assertDatabaseHas('shipment_events', ['shipment_id' => $shipment->id, 'event_type' => 'hub_transfer_dispatched', 'performing_courier_id' => $driver->id, 'recorded_by_logistics_id' => $a[0]->id]);
        $this->assertDatabaseHas('shipments', ['id' => $shipment->id, 'status' => 'in_transfer', 'current_hub_id' => $a[2]->id]);
        $arrived = $this->postJson($this->url($trip, 'arrival'), $this->body(4))->assertOk()->assertJsonPath('data.status', 'in_transfer')
            ->assertJsonPath('data.arrived_at', null)->assertJsonPath('data.courier_arrived_by', $driver->id)
            ->assertJsonPath('data.courier_can_report_arrival', false)->json('data');
        $this->postJson($this->url($trip, 'arrival'), $this->body(4))->assertOk()->assertJsonPath('data.courier_arrived_at', $arrived['courier_arrived_at']);
        $this->assertDatabaseHas('company_trucks', ['id' => $truck->id, 'availability' => 'in_transit', 'last_confirmed_hub_id' => null]);
        $this->assertDatabaseHas('shipment_route_hops', ['shipment_route_id' => $shipment->route->id, 'status' => 'in_transfer']);
        $this->assertDatabaseHas('linehaul_trip_shipments', ['linehaul_trip_id' => $trip->id, 'released_at' => null]);

        $this->actingAs($b[0]);
        $this->receiveTripParcels($trip->id);
        $this->assertSame('received_at_hub', $shipment->fresh()->status->value);
        $this->actingAs($driver)->postJson($this->url($trip, 'arrival'), $this->body(4))->assertOk()->assertJsonPath('data.status', 'received');
        $this->postJson($this->url($trip, 'depart'), $this->body(3))->assertOk()->assertJsonPath('data.departed_at', $departed['departed_at']);
        $this->assertDatabaseCount('linehaul_manifests', 1);
    }

    public function test_late_departure_and_empty_return_keep_receipt_with_logistics(): void
    {
        [$a, $b, $driver, $trip, , $truck] = $this->scheduledTrip();
        $trip->update(['scheduled_for' => now()->subHours(2)]);
        $this->actingAs($a[0])->postJson($this->releaseUrl($trip), $this->body(2))->assertOk();
        $this->actingAs($driver)->postJson($this->url($trip, 'depart'), $this->body(3))->assertOk();
        $this->actingAs($b[0]);
        $this->receiveTripParcels($trip->id);
        $return = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/linehaul/trips/'.$trip->id.'/return', [
            'scheduled_for' => now()->addHour()->toISOString(), 'empty_return' => true,
        ])->assertCreated()->json('data');
        $returnTrip = LinehaulTrip::findOrFail($return['id']);
        $this->getJson('/api/v1/logistics/linehaul/trips')->assertOk()->assertJsonFragment(['id' => $returnTrip->id, 'direction' => 'return']);
        $this->postJson($this->releaseUrl($returnTrip), $this->body(1))->assertOk();
        $this->actingAs($driver)->postJson($this->url($returnTrip, 'depart'), $this->body(2))->assertOk()->assertJsonPath('data.empty_return', true);
        $this->postJson($this->url($returnTrip, 'arrival'), $this->body(3))->assertOk()->assertJsonPath('data.status', 'in_transfer');
        $this->assertDatabaseHas('company_trucks', ['id' => $truck->id, 'availability' => 'in_transit']);
        $this->actingAs($a[0])->postJson('/api/v1/logistics/linehaul/trips/'.$returnTrip->id.'/receive', ['expected_revision' => 4])->assertOk();
        $this->assertDatabaseHas('company_trucks', ['id' => $truck->id, 'availability' => 'available', 'last_confirmed_hub_id' => $a[2]->id]);
        $this->assertDatabaseCount('linehaul_manifests', 1);
    }

    public function test_open_lane_and_resources_are_rechecked_after_release(): void
    {
        [$a, , $driver, $trip, $shipment] = $this->scheduledTrip();
        $lane = $shipment->sortingLane;
        $lane->update(['operational_state' => 'held', 'blocking_reason' => 'Inspect load']);
        $this->actingAs($a[0])->postJson($this->releaseUrl($trip), $this->body(2))->assertConflict()->assertJsonPath('code', 'SORT_LANE_BLOCKED');
        $lane->update(['operational_state' => 'open']);
        $this->postJson($this->releaseUrl($trip), $this->body(2))->assertOk();
        $lane->update(['operational_state' => 'held']);
        $this->actingAs($driver)->postJson($this->url($trip, 'depart'), $this->body(3))->assertConflict()->assertJsonPath('code', 'SORT_LANE_BLOCKED');
        $this->assertNull($trip->fresh()->departed_by);
        $this->assertDatabaseCount('linehaul_manifests', 0);
        $this->assertSame('sorted_at_hub', $shipment->fresh()->status->value);
        $lane->update(['operational_state' => 'open']);
        $driver->courierLogisticsAffiliation()->update(['can_drive_company_truck' => false]);
        $this->postJson($this->url($trip, 'depart'), $this->body(3))->assertUnprocessable()->assertJsonPath('code', 'LINEHAUL_DRIVER_NOT_ELIGIBLE');
    }

    public function test_validation_revisions_approval_and_foreign_driver_scope(): void
    {
        [$a, $b, $driver, $trip] = $this->scheduledTrip();
        foreach (['depart', 'arrival'] as $action) {
            $this->actingAs($b[0])->postJson($this->url($trip, $action), $this->body(2))->assertForbidden();
            $other = $this->courier($a[1]->id, $a[2]->id);
            $this->actingAs($other)->postJson($this->url($trip, $action), $this->body(2))->assertNotFound();
            $this->actingAs($driver)->postJson($this->url($trip, $action), ['expected_revision' => 2])->assertUnprocessable();
            $this->postJson($this->url($trip, $action), [...$this->body(2), 'driver_id' => $other->id])->assertUnprocessable();
        }
        $this->postJson($this->url($trip, 'arrival'), $this->body(2))->assertConflict();
        $this->actingAs($a[0])->postJson($this->releaseUrl($trip), $this->body(1))->assertConflict();
        $trip->update(['status' => 'pending_acceptance']);
        $this->postJson($this->releaseUrl($trip), $this->body(2))->assertConflict();
        $this->actingAs($driver)->postJson($this->url($trip, 'depart'), $this->body(2))->assertConflict();
        $trip->update(['status' => 'cancelled']);
        $this->postJson($this->url($trip, 'depart'), $this->body(2))->assertConflict();
        $this->assertDatabaseCount('linehaul_manifests', 0);
    }

    public function test_disabled_network_blocks_departure_but_does_not_block_arrival_report(): void
    {
        [$a, , $driver, $trip] = $this->scheduledTrip();
        $this->actingAs($a[0])->postJson($this->releaseUrl($trip), $this->body(2))->assertOk();
        $this->actingAs($driver)->postJson($this->url($trip, 'depart'), $this->body(2))->assertConflict()->assertJsonPath('code', 'LINEHAUL_TRIP_CHANGED');
        PlatformFeatureControl::where('key', 'linehaul')->update(['enabled' => false]);
        $this->postJson($this->url($trip, 'depart'), $this->body(3))->assertConflict()->assertJsonPath('code', 'LINEHAUL_DISABLED');
        PlatformFeatureControl::where('key', 'linehaul')->update(['enabled' => true]);
        $this->postJson($this->url($trip, 'depart'), $this->body(3))->assertOk();
        PlatformFeatureControl::where('key', 'linehaul')->update(['enabled' => false]);
        $this->postJson($this->url($trip, 'arrival'), $this->body(4))->assertOk();
    }

    public function test_release_authority_capacity_and_frozen_membership_are_rechecked(): void
    {
        [$a, , $driver, $trip, $shipment, $truck] = $this->scheduledTrip();
        $this->actingAs($a[0])->postJson($this->releaseUrl($trip), $this->body(2))->assertOk();
        $a[0]->update(['status' => 'suspended']);
        $this->actingAs($driver)->postJson($this->url($trip, 'depart'), $this->body(3))->assertForbidden();
        $a[0]->update(['status' => 'active']);
        $trip->refresh()->update(['released_for_departure_by' => null]);
        $this->postJson($this->url($trip, 'depart'), $this->body(3))->assertConflict()->assertJsonPath('code', 'LINEHAUL_RELEASE_INVALID');
        $trip->update(['released_for_departure_by' => $a[0]->id]);
        $truck->update(['max_parcels' => 0]);
        $this->postJson($this->url($trip, 'depart'), $this->body(3))->assertConflict()->assertJsonPath('code', 'LINEHAUL_CAPACITY_CHANGED');
        $truck->update(['max_parcels' => 10]);
        $shipment->increment('revision');
        $this->postJson($this->url($trip, 'depart'), $this->body(3))->assertConflict()->assertJsonPath('code', 'LINEHAUL_RESERVATION_CHANGED');
        $this->assertDatabaseCount('linehaul_manifests', 0);
        $this->assertNull($trip->fresh()->departed_by);
    }

    private function body(int $revision): array
    {
        return ['expected_revision' => $revision, 'confirmation' => true];
    }

    private function url(LinehaulTrip $trip, string $action): string
    {
        return '/api/v1/courier/linehaul-trips/'.$trip->id.'/'.$action;
    }

    private function releaseUrl(LinehaulTrip $trip): string
    {
        return '/api/v1/logistics/linehaul/trips/'.$trip->id.'/release';
    }

    private function scheduledTrip(): array
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
        $driver->courierLogisticsAffiliation()->update(['can_drive_company_truck' => true]);
        $truck = CompanyTruck::create(['logistics_organization_id' => $a[1]->id, 'home_hub_id' => $a[2]->id, 'last_confirmed_hub_id' => $a[2]->id, 'plate_number' => 'DRIVER-001', 'max_parcels' => 10]);
        $shipment = Shipment::whereHas('parcel.waybill', fn ($query) => $query->where('reference', $reference))->sole();
        $trip = $this->actingAs($a[0])->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/linehaul/trips', [
            'next_hub_id' => $b[2]->id, 'company_truck_id' => $truck->id, 'driver_id' => $driver->id,
            'scheduled_for' => now()->addHours(2)->toISOString(), 'shipment_ids' => [$shipment->id],
        ])->assertCreated()->json('data');
        $this->actingAs($b[0])->postJson('/api/v1/logistics/linehaul/trips/'.$trip['id'].'/decision', ['accept' => true, 'expected_revision' => 1])->assertOk();

        return [$a, $b, $driver, LinehaulTrip::findOrFail($trip['id']), $shipment, $truck];
    }
}
