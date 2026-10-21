<?php

namespace Tests\Feature\Courier;

use App\Enums\UserStatus;
use App\Models\CompanyTruck;
use App\Models\LinehaulTrip;
use App\Models\PlatformPolicy;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\HubRoutingFixtures;
use Tests\TestCase;

class LinehaulRouteTest extends TestCase
{
    use HubRoutingFixtures, RefreshDatabase;

    private ?array $providerPayload = null;

    private int $providerStatus = 200;

    private bool $providerFails = false;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.geoapify.server_key' => 'synthetic-route-key']);
        Http::preventStrayRequests();
        Http::fake(['api.geoapify.com/v1/routing*' => fn ($request) => $this->providerFails
            ? (Http::failedConnection())($request)
            : Http::response($this->providerPayload ?? $this->road(), $this->providerStatus)]);
    }

    public function test_assigned_bearer_read_is_private_cached_and_sends_only_coordinates(): void
    {
        [$trip, $driver, $a, $b] = $this->fixture();
        $this->withToken($driver->createToken('test', ['courier'])->plainTextToken);
        $this->getJson($this->url($trip))->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.status', 'ready')->assertJsonPath('data.hubs.0.name', $a[2]->name)
            ->assertJsonPath('data.hubs.1.name', $b[2]->name)->assertJsonPath('data.hubs.1.kind', 'destination')
            ->assertJsonPath('data.summary.distance_metres', 12345)->assertJsonPath('data.summary.duration_seconds', 1800)
            ->assertJsonPath('data.geometry.type', 'LineString')->assertJsonMissing(['apiKey' => 'synthetic-route-key']);
        $this->getJson($this->url($trip))->assertOk();
        Http::assertSentCount(1);
        Http::assertSent(function ($request) use ($a, $b) {
            $this->assertEqualsCanonicalizing(['waypoints', 'mode', 'format', 'apiKey'], array_keys($request->data()));
            $this->assertSame((float) $a[2]->address->latitude.','.(float) $a[2]->address->longitude.'|'.(float) $b[2]->address->latitude.','.(float) $b[2]->address->longitude, $request['waypoints']);

            return $request['mode'] === 'drive';
        });
        $this->assertDatabaseHas('linehaul_trips', ['id' => $trip->id, 'status' => 'scheduled', 'revision' => 1]);
        $this->assertDatabaseCount('linehaul_manifests', 0);
    }

    public function test_foreign_and_unknown_trips_are_hidden_even_after_cache_is_warmed(): void
    {
        [$trip, $driver, $a] = $this->fixture();
        $this->actingAs($driver)->getJson($this->url($trip))->assertOk();
        $other = $this->courier($a[1]->id, $a[2]->id);
        $this->actingAs($other)->getJson($this->url($trip))->assertNotFound()->assertJsonPath('code', 'LINEHAUL_TRIP_NOT_FOUND');
        $this->getJson('/api/v1/courier/linehaul-trips/'.Str::uuid().'/route')->assertNotFound();
        $trip->update(['driver_id' => $other->id]);
        $this->actingAs($driver)->getJson($this->url($trip))->assertNotFound();
        Http::assertSentCount(1);
    }

    public function test_auth_role_and_approval_gates_apply_before_provider_access(): void
    {
        [$trip, $driver, $a] = $this->fixture();
        $this->getJson($this->url($trip))->assertUnauthorized();
        $this->actingAs($a[0])->getJson($this->url($trip))->assertForbidden()->assertJsonPath('code', 'FORBIDDEN_ROLE');
        $driver->update(['status' => UserStatus::Suspended]);
        $this->actingAs($driver)->getJson($this->url($trip))->assertForbidden()->assertJsonPath('code', 'ACCOUNT_SUSPENDED');
        $driver->update(['status' => UserStatus::Active]);
        $driver->courierLogisticsAffiliation()->update(['status' => 'pending']);
        $this->actingAs($driver)->getJson($this->url($trip))->assertForbidden()->assertJsonPath('code', 'LOGISTICS_ASSOCIATION_INVALID');
        Http::assertNothingSent();
    }

    public function test_missing_pin_preserves_known_hub_without_a_fake_route(): void
    {
        [$trip, $driver, , $b] = $this->fixture();
        $b[2]->address->update(['latitude' => null]);
        $this->actingAs($driver)->getJson($this->url($trip))->assertOk()
            ->assertJsonPath('data.reason', 'missing_hub_coordinates')->assertJsonPath('data.geometry', null)
            ->assertJsonPath('data.summary', null)->assertJsonPath('data.hubs.1.latitude', null)
            ->assertJsonPath('data.hubs.1.longitude', null)->assertJsonPath('data.hubs.0.latitude', fn ($value) => is_numeric($value));
        Http::assertNothingSent();
    }

    public function test_current_policy_consent_is_required_before_loading_a_route(): void
    {
        [$trip, $driver] = $this->fixture();
        $admin = User::factory()->create(['role' => 'admin', 'status' => 'active']);
        $policy = PlatformPolicy::create(['type' => 'terms_of_service']);
        $version = $policy->versions()->create([
            'version' => 1, 'title' => 'Terms', 'content' => 'Synthetic terms', 'status' => 'published',
            'requires_reconsent' => false, 'revision' => 1, 'created_by_admin_id' => $admin->id,
            'published_by_admin_id' => $admin->id, 'published_at' => now(),
        ]);
        $policy->update(['current_version_id' => $version->id]);
        $this->actingAs($driver)->getJson($this->url($trip))->assertForbidden()->assertJsonPath('code', 'POLICY_CONSENT_REQUIRED');
        Http::assertNothingSent();
    }

    public function test_pin_changes_and_return_direction_use_current_ordered_hubs(): void
    {
        [$trip, $driver, $a, $b] = $this->fixture();
        $this->actingAs($driver)->getJson($this->url($trip))->assertOk();
        $b[2]->address->update(['latitude' => 15.25]);
        $this->getJson($this->url($trip))->assertOk()->assertJsonPath('data.hubs.1.latitude', 15.25);
        $trip->update(['from_hub_id' => $b[2]->id, 'to_hub_id' => $a[2]->id, 'direction' => 'return', 'parcel_count' => 0]);
        $this->getJson($this->url($trip))->assertOk()->assertJsonPath('data.hubs.0.name', $b[2]->name)->assertJsonPath('data.hubs.1.name', $a[2]->name);
        Http::assertSentCount(3);
    }

    public function test_quota_and_missing_key_do_not_call_provider(): void
    {
        [$trip, $driver] = $this->fixture();
        config(['services.geoapify.server_key' => '']);
        $this->actingAs($driver)->getJson($this->url($trip))->assertOk()->assertJsonPath('data.reason', 'provider_unconfigured');
        Cache::flush();
        config(['services.geoapify.server_key' => 'synthetic-route-key', 'pickup_routes.daily_routing_credit_limit' => 1]);
        $this->getJson($this->url($trip))->assertOk()->assertJsonPath('data.reason', 'quota_guard');
        Http::assertNothingSent();
    }

    #[DataProvider('badRoutes')]
    public function test_bad_provider_responses_have_no_metrics_or_road_line(array $payload, int $status, string $reason): void
    {
        [$trip, $driver] = $this->fixture();
        $this->providerPayload = $payload;
        $this->providerStatus = $status;
        $this->actingAs($driver)->getJson($this->url($trip))->assertOk()->assertJsonPath('data.status', 'unavailable')
            ->assertJsonPath('data.reason', $reason)->assertJsonPath('data.geometry', null)->assertJsonPath('data.summary', null);
        $this->getJson($this->url($trip))->assertOk();
        Http::assertSentCount(1);
        $this->travel(61)->seconds();
        $this->getJson($this->url($trip))->assertOk();
        Http::assertSentCount(2);
    }

    public static function badRoutes(): array
    {
        return [
            'quota' => [[], 429, 'provider_quota'],
            'server' => [[], 500, 'route_unavailable'],
            'empty' => [[], 200, 'route_unavailable'],
            'bad-coordinate' => [['features' => [['properties' => ['distance' => 100, 'time' => 10], 'geometry' => ['type' => 'LineString', 'coordinates' => [[121, 14], [200, 15]]]]]], 200, 'route_unavailable'],
            'negative-metrics' => [['features' => [['properties' => ['distance' => -1, 'time' => 10], 'geometry' => ['type' => 'LineString', 'coordinates' => [[121, 14], [121.1, 14.1]]]]]], 200, 'route_unavailable'],
            'malformed-multiline' => [['features' => [['geometry' => ['type' => 'MultiLineString', 'coordinates' => ['bad']]]]], 200, 'route_unavailable'],
        ];
    }

    public function test_timeout_and_multiline_geometry_are_handled(): void
    {
        [$trip, $driver] = $this->fixture();
        $this->providerFails = true;
        $this->actingAs($driver)->getJson($this->url($trip))->assertOk()->assertJsonPath('data.reason', 'provider_failure');
        Cache::flush();
        $road = $this->road();
        $road['features'][0]['geometry'] = ['type' => 'MultiLineString', 'coordinates' => [[[121, 14], [121.1, 14.1]], [[121.1, 14.1], [121.2, 14.2]]]];
        $this->providerFails = false;
        $this->providerPayload = $road;
        $this->getJson($this->url($trip))->assertOk()->assertJsonPath('data.status', 'ready')->assertJsonCount(4, 'data.geometry.coordinates');
    }

    private function road(): array
    {
        return ['features' => [['properties' => ['distance' => 12345, 'time' => 1800], 'geometry' => ['type' => 'LineString', 'coordinates' => [[121.0001, 14.0001], [121.00015, 14.00012], [121.0002, 14.0002]]]]]];
    }

    private function url(LinehaulTrip $trip): string
    {
        return '/api/v1/courier/linehaul-trips/'.$trip->id.'/route';
    }

    private function fixture(): array
    {
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $driver = $this->courier($a[1]->id, $a[2]->id);
        $truck = CompanyTruck::create(['logistics_organization_id' => $a[1]->id, 'home_hub_id' => $a[2]->id, 'plate_number' => 'ROUTE-TEST', 'max_parcels' => 100]);
        $trip = LinehaulTrip::create([
            'owner_logistics_organization_id' => $a[1]->id, 'home_hub_id' => $a[2]->id,
            'from_hub_id' => $a[2]->id, 'to_hub_id' => $b[2]->id, 'company_truck_id' => $truck->id,
            'driver_id' => $driver->id, 'requested_by' => $a[0]->id, 'direction' => 'outbound',
            'status' => 'scheduled', 'scheduled_for' => now()->addHour(), 'capacity_snapshot' => 100,
            'parcel_count' => 1, 'idempotency_key' => Str::uuid(), 'request_hash' => str_repeat('a', 64),
        ]);

        return [$trip, $driver, $a, $b];
    }
}
