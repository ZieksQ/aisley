<?php

namespace Tests\Feature\Logistics;

use App\Enums\UserStatus;
use App\Models\HubConnection;
use App\Models\PlatformFeatureControl;
use App\Models\Shipment;
use App\Models\ShipmentRoute;
use App\Models\ShipmentRouteHop;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\Support\HubRoutingFixtures;
use Tests\TestCase;

class LinehaulTest extends TestCase
{
    use HubRoutingFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.geoapify.server_key' => 'test-key']);
        Http::preventStrayRequests();
        Http::fake(['api.geoapify.com/v1/routematrix*' => Http::response(['sources_to_targets' => [[['distance' => 1000, 'time' => 100]]]])]);
    }

    public function test_complete_manifest_retries_scope_and_no_individual_receipt(): void
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $foreign = $this->pinnedHub();
        $this->edge($a[2], $b[2]);
        $this->area($b[2]);
        [, $first] = $this->pickupAt($a);
        [, $second] = $this->pickupAt($a);
        $this->receiveOrigin($a, $first);
        $this->receiveOrigin($a, $second);
        $record = $this->sortFor($a, $first, $b[2]->id);
        // Capture the second parcel in the same plan/session.
        $session = $this->getJson('/api/v1/logistics/sorting')->json('data.session');
        $item = collect($session['items'])->first(fn ($item) => $item['reference'] === $second);
        $this->postJson('/api/v1/logistics/sorting/sessions/'.$session['id'].'/batches', ['captures' => [[
            'client_id' => (string) Str::uuid(), 'auto_route' => true, 'reference' => $second,
            'expected_revision' => $item['expected_revision'], 'source' => 'manual', 'captured_at' => now()->toISOString(),
        ]]])->assertOk()->assertJsonPath('summary.sorted', 1);
        $key = (string) Str::uuid();
        $body = ['references' => [$first, $second]];
        $this->withHeader('Idempotency-Key', $key)->postJson('/api/v1/logistics/linehaul/manifests', $body)->assertOk()->assertJsonCount(2, 'data.references');
        $this->postJson('/api/v1/logistics/linehaul/manifests', $body)->assertOk();
        $this->assertDatabaseCount('linehaul_manifests', 1);
        $this->assertSame(2, Shipment::where('status', 'in_transfer')->count());
        $this->actingAs($foreign[0])->getJson('/api/v1/logistics/linehaul')->assertOk()->assertJsonCount(0, 'data.manifests');
        $this->postJson('/api/v1/logistics/linehaul/manifests/'.$key.'/receive')->assertNotFound();
        $this->actingAs($b[0]);
        $shipment = Shipment::whereHas('parcel.waybill', fn ($q) => $q->where('reference', $first))->sole();
        $hop = ShipmentRouteHop::find($record['route']['hops'][0]['id']);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/transfers/arrivals', [
            'reference' => $first, 'hop_id' => $hop->id, 'expected_revision' => $shipment->revision, 'expected_hop_revision' => $hop->revision,
        ])->assertConflict()->assertJsonPath('code', 'LINEHAUL_MANIFEST_REQUIRED');
        // A late member failure must undo earlier members' receipts.
        $manifestItems = json_decode(DB::table('linehaul_manifests')->where('id', $key)->value('items'), true);
        $lastHop = ShipmentRouteHop::findOrFail($manifestItems[count($manifestItems) - 1]['hop_id']);
        DB::table('shipment_route_hops')->where('id', $lastHop->id)->update(['status' => 'pending']);
        $this->postJson('/api/v1/logistics/linehaul/manifests/'.$key.'/receive')->assertNotFound();
        $this->assertSame(2, Shipment::where('status', 'in_transfer')->count());
        DB::table('shipment_route_hops')->where('id', $lastHop->id)->update(['status' => 'in_transfer']);
        PlatformFeatureControl::where('key', 'linehaul')->update(['enabled' => false]);
        HubConnection::query()->update(['is_active' => false]);
        $this->postJson('/api/v1/logistics/linehaul/manifests/'.$key.'/receive')->assertOk()->assertJsonPath('data.status', 'received');
        $this->postJson('/api/v1/logistics/linehaul/manifests/'.$key.'/receive')->assertOk();
        $this->assertSame(2, Shipment::where('current_hub_id', $b[2]->id)->where('status', 'received_at_hub')->count());
    }

    public function test_departure_rolls_back_all_parcels_when_one_is_not_ready(): void
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $this->edge($a[2], $b[2]);
        $this->area($b[2]);
        [, $reference] = $this->pickupAt($a);
        $this->receiveOrigin($a, $reference);
        $this->sortFor($a, $reference, $b[2]->id);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/linehaul/manifests', ['references' => [$reference, 'missing']])->assertNotFound();
        $this->assertDatabaseCount('linehaul_manifests', 0);
        $this->assertSame('sorted_at_hub', Shipment::sole()->status->value);
        PlatformFeatureControl::where('key', 'linehaul')->update(['enabled' => false]);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/linehaul/manifests', ['references' => [$reference]])->assertConflict()->assertJsonPath('code', 'LINEHAUL_DISABLED');
    }

    public function test_logistics_owns_configuration_and_operator_measurements_need_no_matrix(): void
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $this->actingAs($b[0])->putJson('/api/v1/logistics/linehaul/service-areas', ['postal_code' => '6000', 'is_active' => true])->assertOk();
        $this->actingAs($a[0])->putJson('/api/v1/logistics/linehaul/connections', [
            'to_hub_id' => $b[2]->id, 'is_active' => true, 'distance_meters' => 50000, 'duration_seconds' => 3600,
        ])->assertOk();
        $this->pickupAt($a);
        $this->assertSame('planned', ShipmentRoute::sole()->status->value);
        $this->assertSame('operator', ShipmentRouteHop::sole()->provider);
        Http::assertNothingSent();
        $this->actingAs($a[0])->putJson('/api/v1/logistics/linehaul/service-areas', ['postal_code' => '6000', 'is_active' => true])->assertConflict();
        $this->getJson('/api/v1/logistics/linehaul')->assertOk()->assertJsonCount(0, 'data.service_areas');
    }

    public function test_plan_delete_checks_scope_and_revision(): void
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $plan = $this->actingAs($a[0])->postJson('/api/v1/logistics/sorting/plans', ['name' => 'Plan', 'is_active' => true])->assertCreated()->json('data');
        $this->actingAs($b[0])->deleteJson('/api/v1/logistics/sorting/plans/'.$plan['id'], ['expected_revision' => 1])->assertNotFound();
        $this->actingAs($a[0])->deleteJson('/api/v1/logistics/sorting/plans/'.$plan['id'], ['expected_revision' => 2])->assertConflict();
        $this->deleteJson('/api/v1/logistics/sorting/plans/'.$plan['id'], ['expected_revision' => 1])->assertOk();
        $this->assertDatabaseCount('sorting_plans', 0);
    }

    public function test_default_on_holds_unmapped_destinations_and_switch_pauses_new_routes(): void
    {
        $a = $this->pinnedHub();
        $this->assertTrue(config('hub-routing.enabled'));
        $this->pickupAt($a);
        $this->assertSame('destination_unresolved', ShipmentRoute::sole()->failure_code);
        PlatformFeatureControl::where('key', 'linehaul')->update(['enabled' => false]);
        $this->pickupAt($a);
        $this->assertDatabaseCount('shipment_routes', 1);
    }

    public function test_hub_mapping_creates_only_owned_connection_without_admin_approval(): void
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $suspended = $this->pinnedHub();
        $suspended[0]->update(['status' => UserStatus::Suspended]);
        $this->actingAs($a[0]);
        $this->getJson('/api/v1/logistics/sorting/plans')->assertOk()->assertJsonPath('data.next_hubs.0.id', $b[2]->id)->assertJsonCount(1, 'data.next_hubs');
        $lane = $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'LH', 'name' => 'Linehaul lane', 'type' => 'standard'])->assertCreated()->json('data');
        $plan = $this->postJson('/api/v1/logistics/sorting/plans', ['name' => 'Plan'])->assertCreated()->json('data');
        $input = ['expected_revision' => 1, 'lane_id' => $lane['id'], 'destination_type' => 'hub', 'destination_hub_id' => $b[2]->id];
        $path = '/api/v1/logistics/sorting/plans/'.$plan['id'].'/lanes';
        $this->postJson($path, [...$input, 'expected_revision' => 99])->assertConflict();
        $this->postJson($path, [...$input, 'destination_hub_id' => $a[2]->id])->assertUnprocessable();
        $this->postJson($path, [...$input, 'destination_hub_id' => $suspended[2]->id])->assertUnprocessable();
        $this->assertDatabaseCount('hub_connections', 0);
        $this->postJson($path, $input)->assertOk()->assertJsonPath('data.revision', 2);
        $connection = HubConnection::sole();
        $this->assertSame($a[2]->id, $connection->from_hub_id);
        $this->assertSame($b[2]->id, $connection->to_hub_id);
        $this->assertSame($a[0]->id, $connection->created_by);
        $this->assertTrue($connection->is_active);
        $this->actingAs($b[0])->getJson('/api/v1/logistics/linehaul')->assertOk()->assertJsonCount(0, 'data.connections');
        $connection->forceFill(['is_active' => false, 'revision' => 2, 'distance_meters' => 12345, 'duration_seconds' => 1800])->save();
        $this->actingAs($a[0]);
        $second = $this->postJson('/api/v1/logistics/sorting/plans', ['name' => 'Second plan'])->assertCreated()->json('data');
        $this->postJson('/api/v1/logistics/sorting/plans/'.$second['id'].'/lanes', $input)->assertOk();
        $this->assertDatabaseCount('hub_connections', 1);
        $this->assertTrue($connection->fresh()->is_active);
        $this->assertSame(3, $connection->fresh()->revision);
        $this->assertEquals(12345, $connection->fresh()->distance_meters);
    }
}
