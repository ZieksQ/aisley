<?php

namespace Tests\Feature\Logistics;

use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\CompanyTruck;
use App\Models\DeliveryTask;
use App\Models\HubConnection;
use App\Models\Shipment;
use App\Models\ShipmentEvent;
use App\Models\ShipmentRoute;
use App\Models\ShipmentRouteHop;
use App\Models\User;
use App\Models\Waybill;
use App\Services\Fulfillment\FulfillmentTransitionService;
use App\Services\Logistics\Routing\GeoapifyHubMetrics;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\HubRoutingFixtures;
use Tests\TestCase;

class HubRoutingTest extends TestCase
{
    use HubRoutingFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['hub-routing.enabled' => true, 'hub-routing.transfer_handling_seconds' => 0, 'services.geoapify.server_key' => 'test-server-key']);
        Http::preventStrayRequests();
        Http::fake(['api.geoapify.com/v1/routematrix*' => Http::response(['sources_to_targets' => [[['distance' => 1000, 'time' => 100], ['distance' => 3000, 'time' => 300]]]])]);
    }

    public function test_sort_plan_lists_only_active_accepted_outgoing_connections(): void
    {
        $origin = $this->pinnedHub();
        $allowed = $this->pinnedHub();
        $inactive = $this->pinnedHub();
        $suspended = $this->pinnedHub();
        $foreign = $this->pinnedHub();
        $this->edge($origin[2], $allowed[2]);
        $this->edge($origin[2], $inactive[2]);
        HubConnection::where('to_hub_id', $inactive[2]->id)->update(['is_active' => false]);
        $this->edge($origin[2], $suspended[2]);
        $suspended[0]->update(['status' => UserStatus::Suspended]);
        $this->edge($foreign[2], $origin[2]);
        $this->edge($foreign[2], $inactive[2]);

        $this->actingAs($origin[0])->getJson('/api/v1/logistics/sorting/plans')
            ->assertOk()->assertExactJson(['data' => [
                'context' => ['organization_id' => $origin[1]->id, 'hub_id' => $origin[2]->id, 'hub_name' => $origin[2]->name],
                'active_plan_id' => null, 'plans' => [], 'lanes' => [],
                'next_hubs' => collect([$allowed[2]])->sortBy('name')->map(fn ($hub) => ['id' => $hub->id, 'name' => $hub->name])->values()->all(),
            ]]);
    }

    public function test_four_hubs_transfer_custody_then_dispatch_only_at_destination(): void
    {
        $network = [$this->pinnedHub(), $this->pinnedHub(), $this->pinnedHub(), $this->pinnedHub()];
        foreach (range(0, 2) as $i) {
            $this->edge($network[$i][2], $network[$i + 1][2]);
            $this->edge($network[$i + 1][2], $network[$i][2]);
        }
        $this->area($network[3][2]);
        [$order, $reference] = $this->pickupAt($network[0]);
        $route = ShipmentRoute::sole();
        $this->assertNull($route->shipment_id);
        $this->assertSame('planned', $route->status->value);
        $this->assertCount(3, $route->hops);
        $this->assertSame(OrderStatus::ReadyForPickup, $order->fresh()->status);
        $this->assertDatabaseCount('shipments', 0);
        $this->receiveOrigin($network[0], $reference);
        $shipment = Shipment::sole();
        $this->assertSame($shipment->id, $route->fresh()->shipment_id);
        app(FulfillmentTransitionService::class)->ensureForWaybill(Waybill::sole());
        $this->assertDatabaseCount('shipments', 1);
        $this->assertDatabaseCount('parcels', 1);
        [$foreign] = $this->pinnedHub();
        $this->actingAs($foreign)->getJson('/api/v1/logistics/routes/'.$reference)->assertNotFound();
        foreach (range(0, 2) as $i) {
            $record = $this->sortFor($network[$i], $reference, $network[$i + 1][2]->id);
            $hop = $record['route']['hops'][$i];
            $courier = $this->courier($network[$i][1]->id, $network[$i][2]->id);
            $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/dispatch/schedules', [
                'shipment_ids' => [$record['shipment_id']], 'courier_id' => $courier->id, 'scheduled_for' => now()->addHour()->toISOString(),
            ])->assertConflict()->assertJsonPath('code', 'ROUTE_FINAL_MILE_HELD');
            $input = ['reference' => $reference, 'hop_id' => $hop['id'], 'expected_revision' => $record['revision'], 'expected_hop_revision' => $hop['revision']];
            $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/transfers/departures', $input)
                ->assertConflict()->assertJsonPath('code', 'LINEHAUL_TRIP_REQUIRED');
            $driver = $this->courier($network[$i][1]->id, $network[$i][2]->id);
            $driver->courierLogisticsAffiliation()->update(['can_drive_company_truck' => true]);
            $truck = CompanyTruck::create([
                'logistics_organization_id' => $network[$i][1]->id, 'home_hub_id' => $network[$i][2]->id,
                'last_confirmed_hub_id' => $network[$i][2]->id, 'plate_number' => 'HOP-'.$i, 'max_parcels' => 1,
            ]);
            $trip = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/linehaul/trips', [
                'next_hub_id' => $network[$i + 1][2]->id, 'company_truck_id' => $truck->id,
                'driver_id' => $driver->id, 'scheduled_for' => now()->addHour()->toISOString(), 'shipment_ids' => [$record['shipment_id']],
            ])->assertCreated()->json('data');
            $this->actingAs($network[$i + 1][0])->postJson('/api/v1/logistics/linehaul/trips/'.$trip['id'].'/decision', ['accept' => true, 'expected_revision' => 1])->assertOk();
            $departure = $this->actingAs($network[$i][0])->postJson('/api/v1/logistics/linehaul/trips/'.$trip['id'].'/depart', ['expected_revision' => 2])
                ->assertOk()->assertJsonPath('data.status', 'in_transfer')->json('data');
            $this->assertNull($shipment->fresh()->sorting_lane_id);
            $this->assertNull($shipment->fresh()->sorting_session_id);
            $this->assertNotNull(ShipmentRouteHop::find($hop['id'])->source_lane);
            $this->assertSame(OrderStatus::PickedUp, $order->fresh()->status);
            $this->assertSame(0, DeliveryTask::where('leg', 'final_mile')->count());
            $this->actingAs($foreign)->postJson('/api/v1/logistics/linehaul/trips/'.$trip['id'].'/receive', ['expected_revision' => $departure['revision']])->assertNotFound();
            $this->actingAs($network[$i + 1][0])->getJson('/api/v1/logistics/routes/'.$reference)->assertOk()->assertJsonMissingPath('data.route.hops.0.source_lane');
            $this->receiveTripParcels($trip['id']);
            $this->assertSame($network[$i + 1][2]->id, $shipment->fresh()->current_hub_id);
            $this->actingAs($network[$i][0])->getJson('/api/v1/logistics/update-status/records/'.$reference)->assertNotFound();
            $this->actingAs($network[$i + 1][0])->getJson('/api/v1/logistics/update-status/records/'.$reference)->assertOk()->assertJsonCount(0, 'data.tasks');
        }
        $record = $this->sortFor($network[3], $reference, null);
        $this->actingAs($network[0][0])->getJson('/api/v1/logistics/sorting')->assertOk()->assertJsonPath('data.session.items.0.automatic_routing.lane', null)->assertJsonPath('data.session.items.0.can_move', false);
        $this->actingAs($network[3][0]);
        $this->assertSame('completed', $record['route']['status']);
        $courier = $this->courier($network[3][1]->id, $network[3][2]->id);
        $schedule = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/dispatch/schedules', [
            'shipment_ids' => [$record['shipment_id']], 'courier_id' => $courier->id, 'scheduled_for' => now()->addHour()->toISOString(),
            'assignments' => [['shipment_id' => $record['shipment_id'], 'expected_revision' => $record['revision'], 'lane_id' => $record['sorting_lane']['id'], 'lane_revision' => $record['sorting_lane']['revision']]],
        ])->assertCreated()->json('data');
        $this->assertSame(OrderStatus::Assigned, $order->fresh()->status);
        $this->assertSame($network[0][1]->id, $shipment->fresh()->logistics_organization_id);
        $this->assertSame(3, ShipmentEvent::where('event_type', 'hub_transfer_dispatched')->count());
        $this->assertSame(3, ShipmentEvent::where('event_type', 'hub_transfer_received')->count());
        $task = DeliveryTask::where('leg', 'final_mile')->sole();
        $this->actingAs($courier)->postJson('/api/v1/courier/final-mile-tasks/'.$task->id.'/accept')->assertOk();
        $this->getJson('/api/v1/courier/tasks/'.$task->id.'/delivery')->assertOk()->assertJsonPath('data.pickup_hub.name', $network[3][2]->name);
    }

    public function test_same_hub_skips_geoapify_and_uses_existing_final_mile_flow(): void
    {
        $origin = $this->pinnedHub();
        $this->area($origin[2]);
        [$order, $reference] = $this->pickupAt($origin);
        $this->assertSame('local', ShipmentRoute::sole()->status->value);
        $this->assertDatabaseCount('shipment_route_hops', 0);
        Http::assertNothingSent();
        $this->receiveOrigin($origin, $reference);
        // Sorting must use the committed waybill recipient, even if source data is corrupted later.
        DB::table('order_addresses')->where('order_id', $order->id)->update(['postal_code' => '7000']);
        $record = $this->sortFor($origin, $reference, null);
        $courier = $this->courier($origin[1]->id, $origin[2]->id);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/dispatch/schedules', [
            'shipment_ids' => [$record['shipment_id']], 'courier_id' => $courier->id, 'scheduled_for' => now()->addHour()->toISOString(),
            'assignments' => [['shipment_id' => $record['shipment_id'], 'expected_revision' => $record['revision'], 'lane_id' => $record['sorting_lane']['id'], 'lane_revision' => $record['sorting_lane']['revision']]],
        ])->assertCreated();
        $this->assertSame(OrderStatus::Assigned, $order->fresh()->status);
    }

    public function test_shared_postal_coverage_chooses_best_connected_destination_and_prefers_local(): void
    {
        $origin = $this->pinnedHub();
        $direct = $this->pinnedHub();
        $transfer = $this->pinnedHub();
        $near = $this->pinnedHub();
        $this->edge($origin[2], $direct[2]);
        $this->edge($origin[2], $transfer[2]);
        $this->edge($transfer[2], $near[2]);
        HubConnection::where('from_hub_id', $origin[2]->id)->where('to_hub_id', $direct[2]->id)
            ->update(['duration_seconds' => 7000, 'distance_meters' => 50000]);
        HubConnection::where('from_hub_id', $origin[2]->id)->where('to_hub_id', $transfer[2]->id)
            ->update(['duration_seconds' => 1000, 'distance_meters' => 10000]);
        HubConnection::where('from_hub_id', $transfer[2]->id)->where('to_hub_id', $near[2]->id)
            ->update(['duration_seconds' => 1000, 'distance_meters' => 10000]);

        $this->actingAs($direct[0])->putJson('/api/v1/logistics/linehaul/service-areas', ['postal_code' => '6000', 'is_active' => true])->assertOk();
        $this->actingAs($near[0])->putJson('/api/v1/logistics/linehaul/service-areas', ['postal_code' => '6000', 'is_active' => true])->assertOk();
        $this->assertDatabaseCount('hub_service_areas', 2);
        $this->pickupAt($origin);
        $route = ShipmentRoute::sole();
        $this->assertSame($near[2]->id, $route->destination_hub_id);
        $this->assertSame([$transfer[2]->id, $near[2]->id], $route->hops()->orderBy('sequence')->pluck('to_hub_id')->all());

        $this->actingAs($origin[0])->putJson('/api/v1/logistics/linehaul/service-areas', ['postal_code' => '6000', 'is_active' => true])->assertOk();
        $this->pickupAt($origin);
        $this->assertSame('local', ShipmentRoute::where('destination_hub_id', $origin[2]->id)->sole()->status->value);
        Http::assertNothingSent();
    }

    public function test_unresolved_route_is_held_in_exception_even_with_manual_standard_lane(): void
    {
        $origin = $this->pinnedHub();
        [$order, $reference] = $this->pickupAt($origin);
        $this->assertSame('unresolved', ShipmentRoute::sole()->status->value);
        $this->receiveOrigin($origin, $reference);
        $standard = $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'STD', 'name' => 'Standard', 'type' => 'standard'])->assertCreated()->json('data');
        $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'EX', 'name' => 'Exception', 'type' => 'exception'])->assertCreated();
        $session = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/sessions')->assertCreated()->json('data');
        $this->postJson('/api/v1/logistics/sorting/sessions/'.$session['id'].'/batches', ['captures' => [[
            'client_id' => (string) Str::uuid(), 'lane_id' => $standard['id'], 'auto_route' => false, 'reference' => $reference,
            'expected_revision' => $session['items'][0]['expected_revision'], 'source' => 'manual', 'captured_at' => now()->toISOString(),
        ]]])->assertOk()->assertJsonPath('summary.exception', 1)->assertJsonPath('data.0.lane.code', 'EX');
        $shipment = Shipment::sole();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/update-status/transitions', ['reference' => $reference, 'expected_revision' => $shipment->revision, 'target_state' => 'sorted_at_hub'])->assertConflict();
        $this->assertSame('received_at_hub', $shipment->fresh()->status->value);
        $this->assertSame(OrderStatus::PickedUp, $order->fresh()->status);
    }

    public function test_directed_connections_do_not_authorize_reverse_routes(): void
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $this->edge($b[2], $a[2]);
        $this->area($b[2]);
        $this->pickupAt($a);
        $this->assertSame('no_path', ShipmentRoute::sole()->failure_code);
        Http::assertNothingSent();
    }

    public function test_provider_failure_holds_and_missing_coordinates_never_become_zero(): void
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $this->edge($a[2], $b[2]);
        $this->area($b[2]);
        Http::swap(new Factory);
        Http::fake(['*' => Http::response([], 429)]);
        $this->pickupAt($a);
        $this->assertSame('quota', ShipmentRoute::sole()->failure_code);
        $this->assertNull(ShipmentRoute::sole()->distance_meters);
        $b[2]->address->update(['latitude' => null, 'longitude' => null]);
        $this->pickupAt($a);
        $this->assertSame(1, ShipmentRoute::where('failure_code', 'coordinates_missing')->count());
        $this->assertDatabaseCount('shipment_route_hops', 0);
    }

    public function test_pin_changes_invalidate_future_cache_and_do_not_rewrite_committed_hops(): void
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $this->edge($a[2], $b[2]);
        $this->area($b[2]);
        $this->pickupAt($a);
        $first = ShipmentRouteHop::sole();
        $this->pickupAt($a);
        Http::assertSentCount(1);
        $b[2]->address->update(['latitude' => 12.12345]);
        $this->pickupAt($a);
        Http::assertSentCount(2);
        $this->assertSame($first->getRawOriginal('destination_fingerprint'), $first->fresh()->getRawOriginal('destination_fingerprint'));
        $this->assertSame(2, ShipmentRouteHop::query()->distinct()->count('destination_fingerprint'));
        config(['services.geoapify.server_key' => null]);
        $this->pickupAt($a);
        $this->assertSame(1, ShipmentRoute::where('failure_code', 'key_missing')->count());
        Http::assertSentCount(2);
    }

    public function test_hub_metric_cache_key_fits_database_cache_key_limit(): void
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $this->edge($a[2], $b[2]);
        $this->area($b[2]);
        $this->pickupAt($a);

        $metrics = app(GeoapifyHubMetrics::class);
        $source = $metrics->fingerprint($a[2]->address);
        $target = $metrics->fingerprint($b[2]->address);
        $cacheKey = 'hub-metric:'.hash('sha256', implode('|', [
            $a[2]->id,
            $b[2]->id,
            $source,
            $target,
            'drive',
            'metric',
            'free_flow',
            'balanced',
        ]));

        $this->assertLessThanOrEqual(255, strlen((string) config('cache.prefix').$cacheKey));
        $this->assertIsArray(Cache::get($cacheKey));
    }

    public function test_feature_flag_does_not_retroactively_route_legacy_waybills(): void
    {
        config(['hub-routing.enabled' => false]);
        $a = $this->pinnedHub();
        [, $reference] = $this->pickupAt($a);
        config(['hub-routing.enabled' => true]);
        $this->actingAs($a[0])->getJson('/api/v1/logistics/routes/'.$reference)->assertOk()->assertJsonPath('data.route', null);
        $this->assertDatabaseCount('shipment_routes', 0);
        Http::assertNothingSent();
    }

    #[DataProvider('unavailableMetrics')]
    public function test_unavailable_metrics_produce_explicit_holds(string $scenario, string $expected): void
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $this->edge($a[2], $b[2]);
        $this->area($b[2]);
        Http::swap(new Factory);
        if ($scenario === 'key_missing') {
            config(['services.geoapify.server_key' => null]);
            Http::preventStrayRequests();
        } elseif ($scenario === 'local_quota') {
            config(['pickup_routes.daily_matrix_credit_limit' => 0]);
            Http::preventStrayRequests();
        } elseif ($scenario === 'timeout') {
            Http::fake(fn () => throw new ConnectionException('credential-bearing provider URL'));
        } elseif ($scenario === 'malformed') {
            Http::fake(['*' => Http::response(['sources_to_targets' => [[['distance' => 100, 'time' => -1]]]])]);
        } elseif ($scenario === 'null') {
            Http::fake(['*' => Http::response(['sources_to_targets' => [[null]]])]);
        } else {
            Http::fake(['*' => Http::response([], 500)]);
        }
        $this->pickupAt($a);
        $this->assertSame($expected, ShipmentRoute::sole()->failure_code);
        $this->assertNull(ShipmentRoute::sole()->distance_meters);
        $this->assertDatabaseCount('shipment_route_hops', 0);
    }

    public static function unavailableMetrics(): array
    {
        return [['local_quota', 'quota'], ['key_missing', 'key_missing'], ['timeout', 'timeout'], ['malformed', 'malformed'], ['null', 'route_unavailable'], ['error', 'provider_error']];
    }

    public function test_graph_changes_during_measurement_cannot_commit_stale_hops(): void
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $this->edge($a[2], $b[2]);
        $this->area($b[2]);
        Http::swap(new Factory);
        Http::fake(function () {
            HubConnection::query()->update(['is_active' => false, 'revision' => 2]);

            return Http::response(['sources_to_targets' => [[['distance' => 100, 'time' => 10]]]]);
        });
        $this->pickupAt($a);
        $this->assertSame('graph_changed', ShipmentRoute::sole()->failure_code);
        $this->assertDatabaseCount('shipment_route_hops', 0);
    }

    public function test_inactive_connections_and_arbitrary_destinations_cannot_dispatch_a_transfer(): void
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $this->edge($a[2], $b[2]);
        $this->area($b[2]);
        [, $reference] = $this->pickupAt($a);
        $this->receiveOrigin($a, $reference);
        $record = $this->sortFor($a, $reference, $b[2]->id);
        $hop = $record['route']['hops'][0];
        $input = ['reference' => $reference, 'hop_id' => $hop['id'], 'expected_revision' => $record['revision'], 'expected_hop_revision' => $hop['revision']];
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/transfers/departures', [...$input, 'destination_hub_id' => $b[2]->id])->assertUnprocessable();
        $this->withHeader('Idempotency-Key', 'bad-key')->postJson('/api/v1/logistics/transfers/departures', $input)->assertUnprocessable();
        HubConnection::query()->update(['is_active' => false, 'revision' => 2]);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/transfers/departures', $input)->assertConflict()->assertJsonPath('code', 'LINEHAUL_TRIP_REQUIRED');
        $this->assertSame('sorted_at_hub', Shipment::sole()->status->value);
        $this->assertSame(0, ShipmentEvent::where('event_type', 'hub_transfer_dispatched')->count());
    }

    public function test_measured_directed_graph_selects_fastest_path_and_ignores_slow_short_edge(): void
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $c = $this->pinnedHub();
        $this->edge($a[2], $b[2]);
        $this->edge($b[2], $c[2]);
        $this->edge($a[2], $c[2]);
        $this->area($c[2]);
        $from = (float) $a[2]->address->longitude;
        $to = (float) $c[2]->address->longitude;
        Http::swap(new Factory);
        Http::fake(function ($request) use ($from, $to) {
            $this->assertSame('drive', $request['mode']);
            $this->assertArrayNotHasKey('address', $request->data());
            $cells = array_map(fn ($target) => $request['sources'][0]['location'][0] === $from && $target['location'][0] === $to ? ['distance' => 1, 'time' => 1000] : ['distance' => 100, 'time' => 10], $request['targets']);

            return Http::response(['sources_to_targets' => [$cells]]);
        });
        $this->pickupAt($a);
        $route = ShipmentRoute::sole();
        $this->assertSame([$b[2]->id, $c[2]->id], $route->hops->pluck('to_hub_id')->all());
        $this->assertSame(20.0, $route->duration_seconds);
        $this->assertSame(200.0, $route->distance_meters);
    }

    public function test_graph_and_hop_limits_create_holds(): void
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $c = $this->pinnedHub();
        $this->edge($a[2], $b[2]);
        $this->edge($b[2], $c[2]);
        $this->area($c[2]);
        config(['hub-routing.max_nodes' => 2]);
        $this->pickupAt($a);
        $this->assertSame('graph_limit', ShipmentRoute::sole()->failure_code);
        Http::assertNothingSent();
        config(['hub-routing.max_nodes' => 100, 'hub-routing.max_hops' => 1]);
        $this->pickupAt($a);
        $this->assertSame(1, ShipmentRoute::where('failure_code', 'hop_limit')->count());
        $this->assertDatabaseCount('shipment_route_hops', 0);
    }

    public function test_additive_migration_backfills_current_custody_without_routing_existing_waybills(): void
    {
        config(['hub-routing.enabled' => false]);
        $a = $this->pinnedHub();
        [, $reference] = $this->pickupAt($a);
        $this->receiveOrigin($a, $reference);
        $shipment = Shipment::sole();
        $migration = require database_path('migrations/2026_09_18_000001_add_hub_transfer_routing.php');
        if (DB::getDriverName() === 'sqlite') {
            DB::statement('PRAGMA defer_foreign_keys = ON');
        }
        $migration->down();
        $migration->up();
        $this->assertSame($a[2]->id, $shipment->fresh()->current_hub_id);
        $this->assertSame($a[1]->id, $shipment->fresh()->current_logistics_organization_id);
        $this->assertSame('received_at_hub', $shipment->fresh()->status->value);
        $this->assertDatabaseCount('shipment_routes', 0);
        $this->assertDatabaseCount('shipments', 1);
        $this->assertDatabaseCount('parcels', 1);
    }

    public function test_routed_parcels_can_still_be_held_in_manual_damage_exception_lanes(): void
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $this->edge($a[2], $b[2]);
        $this->area($b[2]);
        [, $reference] = $this->pickupAt($a);
        $this->receiveOrigin($a, $reference);
        $standard = $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'STD', 'name' => 'Standard', 'type' => 'standard'])->assertCreated()->json('data');
        $exception = $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'EX', 'name' => 'Exception', 'type' => 'exception'])->assertCreated()->json('data');
        $plan = $this->postJson('/api/v1/logistics/sorting/plans', ['name' => 'Route plan', 'is_active' => true])->assertCreated()->json('data');
        $this->postJson('/api/v1/logistics/sorting/plans/'.$plan['id'].'/lanes', ['expected_revision' => $plan['revision'], 'lane_id' => $standard['id'], 'destination_type' => 'hub', 'destination_hub_id' => $b[2]->id])->assertOk();
        $session = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/sessions')->assertCreated()->json('data');
        $capture = ['client_id' => (string) Str::uuid(), 'lane_id' => $exception['id'], 'auto_route' => false, 'reference' => $reference,
            'expected_revision' => $session['items'][0]['expected_revision'], 'source' => 'manual', 'captured_at' => now()->toISOString(), 'exception_code' => 'damaged'];
        $this->postJson('/api/v1/logistics/sorting/sessions/'.$session['id'].'/batches', ['captures' => [$capture]])->assertOk()->assertJsonPath('summary.exception', 1);
        $this->assertSame('received_at_hub', Shipment::sole()->status->value);
        unset($capture['exception_code']);
        $capture['client_id'] = (string) Str::uuid();
        $capture['auto_route'] = true;
        $this->postJson('/api/v1/logistics/sorting/sessions/'.$session['id'].'/batches', ['captures' => [$capture]])->assertOk()->assertJsonPath('summary.sorted', 1)->assertJsonPath('data.0.lane.id', $standard['id']);
    }

    public function test_route_endpoints_require_active_logistics_role(): void
    {
        $this->getJson('/api/v1/logistics/routes/unknown')->assertUnauthorized();
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $this->actingAs($customer)->getJson('/api/v1/logistics/routes/unknown')->assertForbidden();
        [$logistics] = $this->pinnedHub();
        $logistics->update(['status' => UserStatus::Pending]);
        $this->actingAs($logistics)->postJson('/api/v1/logistics/transfers/departures', [])->assertForbidden();
        $this->postJson('/api/v1/logistics/transfers/arrivals', [])->assertForbidden();
    }
}
