<?php

namespace Tests\Feature\Logistics;

use App\Enums\UserStatus;
use App\Models\HubConnection;
use App\Models\PlatformFeatureControl;
use App\Models\Shipment;
use App\Models\ShipmentRoute;
use App\Models\ShipmentRouteHop;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Cache;
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

    public function test_partner_directory_search_pagination_and_safe_projection(): void
    {
        $origin = $this->pinnedHub();
        for ($i = 0; $i < 21; $i++) {
            $partner = $this->pinnedHub();
            $partner[1]->update(['business_name' => 'Partner '.str_pad((string) $i, 2, '0', STR_PAD_LEFT)]);
        }
        $suspended = $this->pinnedHub();
        $suspended[0]->update(['status' => UserStatus::Suspended]);
        $this->actingAs($origin[0])->getJson('/api/v1/logistics/linehaul')
            ->assertOk()->assertJsonCount(20, 'data.hubs')->assertJsonPath('data.hub_directory.total', 21)
            ->assertJsonPath('data.hub_directory.last_page', 2)->assertJsonMissingPath('data.hubs.0.address');
        $this->getJson('/api/v1/logistics/linehaul?page=2')->assertOk()->assertJsonCount(1, 'data.hubs');
        $this->getJson('/api/v1/logistics/linehaul?search=partner%2007')->assertOk()
            ->assertJsonCount(1, 'data.hubs')->assertJsonPath('data.hubs.0.business_name', 'Partner 07');
        $this->getJson('/api/v1/logistics/linehaul?search=Manila')->assertOk()->assertJsonPath('data.hub_directory.total', 21);
        $this->getJson('/api/v1/logistics/linehaul?page=0')->assertUnprocessable();
        Http::assertNothingSent();
    }

    public function test_simple_connect_and_disconnect_preserve_recorded_road_metrics(): void
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $this->edge($a[2], $b[2]);
        DB::table('hub_connections')->update(['distance_meters' => 50000, 'duration_seconds' => 3600]);
        $this->actingAs($a[0])->putJson('/api/v1/logistics/linehaul/connections', [
            'to_hub_id' => $b[2]->id, 'is_active' => false, 'expected_revision' => 1,
        ])->assertOk()->assertJsonPath('data.distance_meters', 50000)->assertJsonPath('data.duration_seconds', 3600);
        $this->putJson('/api/v1/logistics/linehaul/connections', [
            'to_hub_id' => $b[2]->id, 'is_active' => true, 'expected_revision' => 2,
        ])->assertOk()->assertJsonPath('data.is_active', false)->assertJsonPath('data.distance_meters', 50000);
        Http::assertNothingSent();
    }

    public function test_sorting_retries_held_route_after_network_setup_without_replacing_history(): void
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        [, $reference] = $this->pickupAt($a);
        $routeId = ShipmentRoute::sole()->id;
        $this->assertSame('destination_unresolved', ShipmentRoute::sole()->failure_code);
        $this->receiveOrigin($a, $reference);
        $this->edge($a[2], $b[2]);
        DB::table('hub_connections')->update(['distance_meters' => 50000, 'duration_seconds' => 3600]);
        $this->area($b[2]);
        $record = $this->sortFor($a, $reference, $b[2]->id);
        $this->assertSame('sorted_at_hub', $record['status']);
        $this->assertSame($routeId, ShipmentRoute::sole()->id);
        $this->assertSame('planned', ShipmentRoute::sole()->status->value);
        $this->assertSame($b[2]->id, ShipmentRouteHop::sole()->to_hub_id);
        $this->getJson('/api/v1/logistics/linehaul')->assertOk()->assertJsonPath('data.ready_groups.0.next_hub_id', $b[2]->id);
        Http::assertNothingSent();
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
        $this->getJson('/api/v1/logistics/linehaul')->assertOk()
            ->assertJsonPath('data.ready_groups.0.next_hub_id', $b[2]->id)
            ->assertJsonCount(2, 'data.ready_groups.0.references');
        $key = (string) Str::uuid();
        $body = ['next_hub_id' => $b[2]->id];
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
        $connection = HubConnection::sole();
        $this->actingAs($b[0])->putJson('/api/v1/logistics/linehaul/connections/'.$connection->id.'/consent', ['accept' => true, 'expected_revision' => $connection->revision])->assertOk();
        $this->pickupAt($a);
        $this->assertSame('planned', ShipmentRoute::sole()->status->value);
        $this->assertSame('operator', ShipmentRouteHop::sole()->provider);
        Http::assertNothingSent();
        $this->actingAs($a[0])->putJson('/api/v1/logistics/linehaul/service-areas', ['postal_code' => '6000', 'is_active' => true])->assertOk();
        $this->getJson('/api/v1/logistics/linehaul')->assertOk()->assertJsonCount(1, 'data.service_areas');
        $this->assertDatabaseCount('hub_service_areas', 2);
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

    public function test_connections_require_receiver_consent_and_plan_cannot_enable_them(): void
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $foreign = $this->pinnedHub();
        $this->actingAs($a[0]);
        $this->getJson('/api/v1/logistics/sorting/plans')->assertOk()->assertJsonCount(0, 'data.next_hubs');
        $lane = $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'LH', 'name' => 'Linehaul lane', 'type' => 'standard'])->assertCreated()->json('data');
        $plan = $this->postJson('/api/v1/logistics/sorting/plans', ['name' => 'Plan'])->assertCreated()->json('data');
        $input = ['expected_revision' => 1, 'lane_id' => $lane['id'], 'destination_type' => 'hub', 'destination_hub_id' => $b[2]->id];
        $mappingPath = '/api/v1/logistics/sorting/plans/'.$plan['id'].'/lanes';
        $this->postJson($mappingPath, $input)->assertUnprocessable()->assertJsonPath('code', 'SORT_PLAN_CONNECTION_REQUIRED');
        $this->assertDatabaseCount('hub_connections', 0);
        $connection = $this->putJson('/api/v1/logistics/linehaul/connections', ['to_hub_id' => $b[2]->id, 'is_active' => true])->assertOk()->assertJsonPath('data.is_active', false)->json('data');
        $consentPath = '/api/v1/logistics/linehaul/connections/'.$connection['id'].'/consent';
        $this->putJson($consentPath, ['accept' => true, 'expected_revision' => 1])->assertNotFound();
        $this->actingAs($foreign[0])->putJson($consentPath, ['accept' => true, 'expected_revision' => 1])->assertNotFound();
        $this->actingAs($b[0])->getJson('/api/v1/logistics/linehaul')->assertOk()->assertJsonPath('data.incoming_connections.0.id', $connection['id']);
        $this->putJson($consentPath, ['accept' => true, 'expected_revision' => 99])->assertConflict();
        $this->putJson($consentPath, ['accept' => true, 'expected_revision' => 1])->assertOk()->assertJsonPath('data.is_active', true);
        $this->actingAs($a[0])->getJson('/api/v1/logistics/sorting/plans')->assertOk()->assertJsonPath('data.next_hubs.0.id', $b[2]->id);
        $this->postJson($mappingPath, $input)->assertOk();
        $this->assertSame(2, HubConnection::sole()->revision);
        $this->actingAs($b[0])->putJson($consentPath, ['accept' => false, 'expected_revision' => 2])->assertOk();
        $this->actingAs($a[0])->putJson('/api/v1/logistics/linehaul/connections', ['to_hub_id' => $b[2]->id, 'is_active' => true, 'expected_revision' => 3])->assertOk()->assertJsonPath('data.is_active', false);
        $this->getJson('/api/v1/logistics/sorting/plans')->assertOk()->assertJsonCount(0, 'data.next_hubs');
        $this->putJson('/api/v1/logistics/linehaul/connections', ['to_hub_id' => $b[2]->id, 'is_active' => false, 'expected_revision' => 4])->assertOk();
        $this->actingAs($b[0])->putJson($consentPath, ['accept' => true, 'expected_revision' => 5])->assertConflict()->assertJsonPath('code', 'LINEHAUL_REQUEST_WITHDRAWN');
        Http::assertNothingSent();
    }

    public function test_consent_migration_pauses_legacy_links_and_preserves_route_history(): void
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $this->edge($a[2], $b[2]);
        $this->area($b[2]);
        $this->pickupAt($a);
        $route = ShipmentRoute::sole()->toArray();
        $hop = ShipmentRouteHop::sole()->toArray();
        $migration = require database_path('migrations/2026_09_19_000001_add_linehaul_connection_consent.php');
        $migration->down();
        $migration->up();
        $this->assertFalse(HubConnection::sole()->is_active);
        $this->assertFalse(HubConnection::sole()->receiver_accepted);
        $this->assertTrue(HubConnection::sole()->sender_requested);
        $this->assertSame(2, HubConnection::sole()->revision);
        $this->assertSame($route, ShipmentRoute::sole()->toArray());
        $this->assertSame($hop, ShipmentRouteHop::sole()->toArray());
    }

    public function test_long_distance_surcharges_are_counted_once_and_cached(): void
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $this->edge($a[2], $b[2]);
        $this->area($b[2]);
        Http::swap(new Factory);
        Http::preventStrayRequests();
        Http::fake(['api.geoapify.com/v1/routematrix*' => Http::response(['sources_to_targets' => [[['distance' => 1200000, 'time' => 50000]]]])]);
        $this->pickupAt($a);
        $key = 'geoapify:route-matrix-credits:'.now('UTC')->format('Y-m-d');
        $this->assertSame(3, Cache::get($key));
        $this->pickupAt($a);
        $this->assertSame(3, Cache::get($key));
        Http::assertSentCount(1);
    }

    public function test_routing_ignores_unaccepted_edges_and_dead_ends_and_reuses_cached_metrics(): void
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $deadEnd = $this->pinnedHub();
        $this->edge($a[2], $b[2]);
        $this->edge($a[2], $deadEnd[2]);
        $this->edge($b[2], $deadEnd[2]);
        $this->area($b[2]);
        $this->pickupAt($a);
        $this->assertSame('planned', ShipmentRoute::sole()->status->value);
        Http::assertSentCount(1);
        Http::assertSent(fn ($request) => count($request['targets']) === 1);
        $this->pickupAt($a);
        Http::assertSentCount(1);
        HubConnection::where('to_hub_id', $b[2]->id)->update(['receiver_accepted' => false]);
        $this->pickupAt($a);
        $this->assertSame('no_path', ShipmentRoute::latest('id')->get()->firstWhere('failure_code', 'no_path')->failure_code);
        Http::assertSentCount(1);
    }
}
