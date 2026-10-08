<?php

namespace Tests\Feature;

use App\Enums\CourierAffiliationStatus;
use App\Enums\Logistics\SortingLaneType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\CompanyTruck;
use App\Models\CourierLogisticsAffiliation;
use App\Models\HubConnection;
use App\Models\HubServiceArea;
use App\Models\LogisticsHub;
use App\Models\LogisticsRateRule;
use App\Models\LogisticsShippingRateAcceptance;
use App\Models\Shop;
use App\Models\SortingLane;
use App\Models\SortingPlan;
use App\Models\User;
use App\Services\Finance\ShippingQuotationService;
use App\Services\Logistics\Routing\CheckoutRoutePlanner;
use App\Services\Logistics\Routing\DirectedHubPathFinder;
use App\Services\Logistics\Sorting\SortingVersionService;
use App\Services\Logistics\SortingPlanService;
use Database\Seeders\LuzonLogisticsSeeder;
use Database\Seeders\PhilippinesLogistics\RegionalAccountSeeder;
use Database\Seeders\PhilippinesLogistics\RegionalHubCatalog;
use Database\Seeders\PhilippinesLogistics\RegionalNetworkSeeder;
use Database\Seeders\PhilippinesLogistics\RegionalPostalLaneSeeder;
use Database\Seeders\PhilippinesLogisticsSeeder;
use Database\Seeders\ProductSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class PhilippinesLogisticsSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_complete_regional_network_has_pins_published_lanes_fleet_and_qualified_drivers(): void
    {
        $this->seedNetwork();

        $this->assertDatabaseCount('logistics_hubs', 18);
        $this->assertDatabaseCount('hub_connections', 42);
        $this->assertDatabaseCount('hub_service_areas', 18);
        $this->assertDatabaseCount('company_trucks', 36);
        $this->assertDatabaseCount('sorting_plans', 18);
        $this->assertDatabaseCount('sorting_plan_versions', 18);
        $this->assertDatabaseCount('sorting_plan_activations', 18);
        $this->assertDatabaseCount('sorting_lanes', 78);
        $this->assertDatabaseCount('sorting_plan_lanes', 60);
        $this->assertDatabaseCount('logistics_rate_cards', 18);
        $this->assertDatabaseCount('logistics_service_rates', 54);
        $this->assertDatabaseCount('logistics_rate_rules', 756);
        $this->assertDatabaseCount('logistics_shipping_rate_acceptances', 18);
        $this->assertDatabaseCount('sandbox_gateway_accounts', 18);

        foreach (RegionalHubCatalog::hubs() as $definition) {
            $owner = User::where('email', "logistics.{$definition['account']}@example.com")->firstOrFail();
            $hub = $owner->logisticsOrganization->hub;
            $this->assertTrue(Hash::check('logistics123', $owner->password));
            $this->assertSame($definition['region'], $hub->address->region);
            $this->assertEquals($definition['latitude'], $hub->address->latitude);
            $this->assertEquals($definition['longitude'], $hub->address->longitude);
            $this->assertDatabaseHas('hub_service_areas', ['logistics_hub_id' => $hub->id, 'postal_code' => $definition['postal_code'], 'is_active' => true]);
            $plan = app(SortingPlanService::class)->plansForHub($hub->logistics_organization_id, $hub->id);
            $this->assertSame(1, $plan->activeVersion->number);
            $this->assertFalse($plan->draft_dirty);
            $this->assertTrue($plan->lanes->every(fn ($mapping) => $mapping->lane->logistics_hub_id === $hub->id
                && $mapping->lane->type === SortingLaneType::Standard && $mapping->lane->is_active));
            $this->assertCount(2, CourierLogisticsAffiliation::where('logistics_hub_id', $hub->id)
                ->where('status', CourierAffiliationStatus::Approved)->where('can_drive_company_truck', true)->get());
            foreach (range(1, 5) as $number) {
                $courier = User::where('email', sprintf('courier.%s.%02d@example.com', $definition['account'], $number))->firstOrFail();
                $this->assertTrue(Hash::check('courier123', $courier->password));
                $this->assertSame($hub->id, $courier->courierLogisticsAffiliation->logistics_hub_id);
                $this->assertSame($number <= 2, $courier->courierLogisticsAffiliation->can_drive_company_truck);
            }
        }
        Http::assertNothingSent();
    }

    public function test_every_region_is_reachable_and_checkout_uses_complete_published_next_hub_routes(): void
    {
        $this->seedNetwork();
        $hubs = LogisticsHub::with('organization.user')->get();
        $edges = HubConnection::query()->get()->toArray();
        foreach ($hubs as $origin) {
            foreach ($hubs as $destination) {
                $path = app(DirectedHubPathFinder::class)->find($origin->id, $destination->id, $edges);
                $this->assertNotNull($path);
                $this->assertLessThanOrEqual(24500, 8000 + 1500 * count($path));
            }
        }
        $origin = User::where('email', 'logistics.luzon01@example.com')->firstOrFail()->logisticsOrganization->hub;
        foreach (RegionalHubCatalog::hubs() as $definition) {
            $route = app(CheckoutRoutePlanner::class)->plan($origin, $definition['postal_code']);
            $this->assertSame($definition['slug'] === 'ncr' ? 'local' : 'planned', $route['status']);
            foreach ($route['hops'] as $hop) {
                $plan = SortingPlan::where('logistics_hub_id', $hop['from_hub_id'])->where('is_active', true)->firstOrFail();
                $this->assertTrue(collect($plan->activeVersion->mappings)->contains(fn ($mapping) => $mapping['destination_type'] === 'hub'
                    && $mapping['destination_hub_id'] === $hop['to_hub_id']));
                $this->assertGreaterThan(0, $hop['distance_meters']);
                $this->assertGreaterThan(0, $hop['duration_seconds']);
            }
        }
        // No invented transoceanic direct edge or connection between distant regions.
        $this->assertSame(21, count(RegionalNetworkSeeder::corridors()));
        Http::assertNothingSent();
    }

    public function test_actual_shipping_quote_charges_each_leg_once_and_supports_all_shop_categories(): void
    {
        $this->seedNetwork();
        config(['seller.initial.email' => null, 'seller.initial.password' => null]);
        $this->seed(ProductSeeder::class);
        $this->seed(PhilippinesLogisticsSeeder::class);
        $owner = User::where('email', 'logistics.luzon01@example.com')->firstOrFail();
        $organization = $owner->logisticsOrganization;
        $shop = Shop::where('slug', 'aisley-demo-store')->firstOrFail();
        $product = $shop->products()->firstOrFail();
        $product->forceFill(['shipping_weight_grams' => 1000, 'shipping_length_mm' => 200,
            'shipping_width_mm' => 100, 'shipping_height_mm' => 50])->save();
        $destination = User::where('email', 'logistics.region-11@example.com')->firstOrFail()->logisticsOrganization->hub->address;
        $lines = [['product' => $product, 'variant' => null, 'quantity' => 1]];
        $quote = app(ShippingQuotationService::class)->quote($shop, $destination, $lines, $organization->id);
        $this->assertSame('planned', $quote['route_snapshot']['status']);
        $this->assertSame(8000 + 1500 * count($quote['route_snapshot']['hops']), $quote['shipping_cents']);
        $this->assertSame(0, $quote['additional_weight_fee_cents']);
        $this->assertCount(count($quote['route_snapshot']['hops']) + 2, $quote['logistics_charge_inputs']);
        $local = app(ShippingQuotationService::class)->quote($shop, $organization->hub->address, $lines, $organization->id);
        $this->assertSame('local', $local['route_snapshot']['status']);
        $this->assertSame(8000, $local['shipping_cents']);
        $product->update(['shipping_weight_grams' => 1500]);
        $heavier = app(ShippingQuotationService::class)->quote($shop, $destination, $lines, $organization->id);
        $this->assertSame(1000 + 250 * count($quote['route_snapshot']['hops']), $heavier['additional_weight_fee_cents']);
        $this->assertDatabaseCount('shop_logistics_providers', 18);
        Http::assertNothingSent();
    }

    public function test_rerun_preserves_operator_accounts_pins_decisions_rates_and_operational_state(): void
    {
        $this->seedNetwork();
        $owner = User::where('email', 'logistics.luzon01@example.com')->firstOrFail();
        $hub = $owner->logisticsOrganization->hub;
        $owner->update(['password' => 'operator-secret', 'status' => UserStatus::Suspended]);
        $hub->address->update(['latitude' => null, 'longitude' => null]);
        $courier = User::where('email', 'courier.luzon01.01@example.com')->firstOrFail();
        $courier->update(['status' => UserStatus::Suspended]);
        $courier->courierLogisticsAffiliation->update(['can_drive_company_truck' => false, 'status' => CourierAffiliationStatus::Rejected]);
        $edge = HubConnection::where('from_hub_id', $hub->id)->firstOrFail();
        $edge->forceFill(['is_active' => false, 'receiver_accepted' => false, 'distance_meters' => 12345])->save();
        $coverage = HubServiceArea::where('logistics_hub_id', $hub->id)->firstOrFail();
        $coverage->update(['is_active' => false]);
        $truck = CompanyTruck::where('home_hub_id', $hub->id)->firstOrFail();
        $truck->update(['availability' => 'in_transit', 'max_parcels' => 99]);
        $lane = SortingLane::where('logistics_hub_id', $hub->id)->where('type', 'standard')->firstOrFail();
        $lane->update(['is_active' => false, 'name' => 'Operator lane']);
        $plan = SortingPlan::where('logistics_hub_id', $hub->id)->firstOrFail();
        $snapshot = $plan->activeVersion->toArray();
        $plan->update(['is_active' => false]);
        $rule = LogisticsRateRule::whereHas('card', fn ($q) => $q->where('logistics_organization_id', $hub->logistics_organization_id))->firstOrFail();
        $rule->update(['additional_fee_cents' => 123]);
        $acceptance = LogisticsShippingRateAcceptance::where('logistics_organization_id', $hub->logistics_organization_id)->firstOrFail();
        $acceptance->update(['revoked_at' => now()]);

        $this->seed(PhilippinesLogisticsSeeder::class);

        $this->assertDatabaseCount('users', 109);
        $this->assertDatabaseCount('company_trucks', 36);
        $this->assertDatabaseCount('sorting_plan_versions', 18);
        $this->assertDatabaseCount('logistics_rate_rules', 756);
        $this->assertTrue(Hash::check('operator-secret', $owner->fresh()->password));
        $this->assertSame(UserStatus::Suspended, $owner->fresh()->status);
        $this->assertNull($hub->address->fresh()->latitude);
        $this->assertNull($hub->address->fresh()->longitude);
        $this->assertSame(UserStatus::Suspended, $courier->fresh()->status);
        $this->assertSame(CourierAffiliationStatus::Rejected, $courier->courierLogisticsAffiliation->fresh()->status);
        $this->assertFalse($courier->courierLogisticsAffiliation->fresh()->can_drive_company_truck);
        $this->assertFalse($edge->fresh()->is_active);
        $this->assertFalse($edge->fresh()->receiver_accepted);
        $this->assertEquals(12345, $edge->fresh()->distance_meters);
        $this->assertFalse($coverage->fresh()->is_active);
        $this->assertSame('in_transit', $truck->fresh()->availability->value);
        $this->assertSame(99, $truck->fresh()->max_parcels);
        $this->assertSame('Operator lane', $lane->fresh()->name);
        $this->assertFalse($lane->fresh()->is_active);
        $this->assertFalse($plan->fresh()->is_active);
        $this->assertSame($snapshot, $plan->activeVersion->fresh()->toArray());
        $this->assertSame(123, $rule->fresh()->additional_fee_cents);
        $this->assertNotNull($acceptance->fresh()->revoked_at);
    }

    public function test_existing_luzon_accounts_are_reused_and_review_decisions_are_not_overwritten(): void
    {
        $this->seed(LuzonLogisticsSeeder::class);
        $owner = User::where('email', 'logistics.luzon01@example.com')->firstOrFail();
        $hubId = $owner->logisticsOrganization->hub->id;
        $driver = User::where('email', 'courier.luzon01.01@example.com')->firstOrFail()->courierLogisticsAffiliation;
        $driver->update(['can_drive_company_truck' => false]);

        $this->seedNetwork();

        $this->assertDatabaseCount('logistics_hubs', 18);
        $this->assertDatabaseCount('courier_logistics_affiliations', 90);
        $this->assertSame($hubId, $owner->fresh()->logisticsOrganization->hub->id);
        $this->assertFalse($driver->fresh()->can_drive_company_truck);
    }

    public function test_development_network_is_blocked_in_production(): void
    {
        $original = app()->environment();
        app()->detectEnvironment(fn () => 'production');
        try {
            app(PhilippinesLogisticsSeeder::class)->run();
        } finally {
            app()->detectEnvironment(fn () => $original);
        }
        foreach (['users', 'addresses', 'company_trucks', 'hub_connections', 'shop_categories', 'logistics_rate_cards'] as $table) {
            $this->assertDatabaseCount($table, 0);
        }
    }

    public function test_existing_operator_plan_keeps_its_activation_and_regional_plan_is_published_inactive(): void
    {
        $definition = RegionalHubCatalog::hubs()[0];
        $hub = app(RegionalAccountSeeder::class)->seed($definition, 1);
        $operator = SortingPlan::create([
            'logistics_organization_id' => $hub->logistics_organization_id,
            'logistics_hub_id' => $hub->id,
            'created_by_logistics_id' => $hub->organization->user_id,
            'name' => 'Existing operator draft', 'is_active' => false, 'revision' => 7,
        ]);

        $this->seedNetwork();

        $fixture = SortingPlan::where('logistics_hub_id', $hub->id)->where('name', 'Philippines regional network')->firstOrFail();
        $this->assertFalse($fixture->is_active);
        $this->assertNull($fixture->active_version_id);
        $this->assertCount(1, $fixture->versions);
        $this->assertGreaterThan(1, count($fixture->versions->first()->mappings));
        $this->assertSame(7, $operator->fresh()->revision);
        $this->assertFalse($operator->fresh()->is_active);
        $this->assertTrue($operator->fresh()->draft_dirty);
        $this->assertDatabaseCount('sorting_plan_activations', 17);
        $this->seed(PhilippinesLogisticsSeeder::class);
        $this->assertDatabaseCount('sorting_plans', 19);
        $this->assertDatabaseCount('sorting_plan_versions', 18);
    }

    public function test_new_plan_has_a_distinct_lane_for_every_active_supported_postal_code(): void
    {
        $definition = RegionalHubCatalog::hubs()[0];
        $hub = app(RegionalAccountSeeder::class)->seed($definition, 1);
        foreach (['1200' => true, '1201' => true, '1202' => false] as $code => $active) {
            HubServiceArea::create(['logistics_hub_id' => $hub->id, 'postal_code' => (string) $code,
                'is_active' => $active, 'revision' => 1, 'created_by' => $hub->organization->user_id]);
        }

        $this->seedNetwork();

        $plan = SortingPlan::where('logistics_hub_id', $hub->id)->where('is_active', true)->firstOrFail();
        $postal = collect($plan->activeVersion->mappings)->where('destination_type', 'postal_code');
        $this->assertSame(['1018', '1200', '1201'], $postal->pluck('postal_code')->sort()->values()->all());
        $this->assertCount(3, $postal->pluck('sorting_lane_id')->unique());
        $this->assertTrue(SortingLane::whereIn('id', $postal->pluck('sorting_lane_id'))->get()
            ->every(fn ($lane) => $lane->logistics_hub_id === $hub->id && $lane->is_active
                && $lane->type === SortingLaneType::Standard));
        $this->assertDatabaseMissing('sorting_plan_lanes', ['sorting_plan_id' => $plan->id, 'postal_code' => '1202']);
    }

    public function test_rerun_repairs_missing_and_shared_postal_lanes_with_an_idempotent_successor(): void
    {
        $this->seedNetwork();
        $actor = User::where('email', 'logistics.luzon01@example.com')->firstOrFail();
        $hub = $actor->logisticsOrganization->hub;
        $plan = SortingPlan::where('logistics_hub_id', $hub->id)->where('is_active', true)->firstOrFail();
        // The selected plan may be an operator's plan rather than the named fixture.
        $plan->update(['name' => 'Operator selected plan']);
        foreach (['1200', '1201', '1202'] as $code) {
            HubServiceArea::create(['logistics_hub_id' => $hub->id, 'postal_code' => $code,
                'is_active' => $code !== '1202', 'revision' => 1, 'created_by' => $actor->id]);
        }
        $versions = app(SortingVersionService::class);
        $versions->action($actor, $plan, 'draft', ['expected_revision' => $plan->revision], (string) Str::uuid());
        $local = $plan->lanes()->where('postal_code', '1018')->firstOrFail();
        $plan->lanes()->create(['destination_type' => 'postal_code', 'postal_code' => '1200',
            'sorting_lane_id' => $local->sorting_lane_id, 'position' => 5]);
        $versions->action($actor, $plan, 'publish', ['expected_revision' => $plan->fresh()->revision,
            'activate' => true], (string) Str::uuid());
        $before = $plan->fresh()->activeVersion;
        $snapshot = $before->toArray();
        $transferFacts = fn ($mappings) => collect($mappings)->where('destination_type', 'hub')
            ->map(fn ($mapping) => collect($mapping)->except('id')->all())->values()->all();
        $transfers = $transferFacts($before->mappings);

        $this->seed(PhilippinesLogisticsSeeder::class);

        $repaired = $plan->fresh();
        $this->assertTrue($repaired->is_active);
        $this->assertSame(3, $repaired->activeVersion->number);
        $postal = collect($repaired->activeVersion->mappings)->where('destination_type', 'postal_code');
        $this->assertSame(['1018', '1200', '1201'], $postal->pluck('postal_code')->sort()->values()->all());
        $this->assertCount(3, $postal->pluck('sorting_lane_id')->unique());
        $this->assertSame($snapshot, $before->fresh()->toArray());
        $this->assertSame($transfers, $transferFacts($repaired->activeVersion->mappings));
        $this->assertSame('local', app(CheckoutRoutePlanner::class)->plan($hub, '1201')['status']);
        $selection = $repaired->active_version_id;
        $laneCount = SortingLane::count();
        $this->seed(PhilippinesLogisticsSeeder::class);
        $this->assertSame($selection, $plan->fresh()->active_version_id);
        $this->assertSame(3, $plan->versions()->count());
        $this->assertSame($laneCount, SortingLane::count());
    }

    public function test_postal_repair_completes_the_active_version_without_changing_an_unfinished_operator_draft(): void
    {
        $this->seedNetwork();
        $actor = User::where('email', 'logistics.luzon01@example.com')->firstOrFail();
        $hub = $actor->logisticsOrganization->hub;
        $plan = SortingPlan::where('logistics_hub_id', $hub->id)->where('is_active', true)->firstOrFail();
        HubServiceArea::create(['logistics_hub_id' => $hub->id, 'postal_code' => '1200',
            'is_active' => true, 'revision' => 1, 'created_by' => $actor->id]);
        app(SortingVersionService::class)->action($actor, $plan, 'draft', [
            'expected_revision' => $plan->revision,
        ], (string) Str::uuid());
        $plan->lanes()->where('postal_code', '1018')->delete();
        $before = $plan->fresh()->toArray();
        $draft = $plan->lanes()->get()->toArray();
        $published = $plan->fresh()->activeVersion->toArray();

        $this->seed(PhilippinesLogisticsSeeder::class);

        $repaired = $plan->fresh();
        $this->assertTrue($repaired->draft_dirty);
        $this->assertTrue($repaired->is_active);
        $this->assertNotSame($before['active_version_id'], $repaired->active_version_id);
        $this->assertSame($draft, $plan->lanes()->get()->toArray());
        $this->assertSame(2, $plan->versions()->count());
        $this->assertSame($published, $plan->versions()->whereKey($before['active_version_id'])->firstOrFail()->toArray());
        $postal = collect($repaired->activeVersion->mappings)->where('destination_type', 'postal_code');
        $this->assertSame(['1018', '1200'], $postal->pluck('postal_code')->sort()->values()->all());
        $this->assertCount(2, $postal->pluck('sorting_lane_id')->unique());
        $this->assertSame('local', app(CheckoutRoutePlanner::class)->plan($hub, '1200')['status']);
        $this->seed(PhilippinesLogisticsSeeder::class);
        $this->assertSame($repaired->active_version_id, $plan->fresh()->active_version_id);
        $this->assertSame($draft, $plan->lanes()->get()->toArray());
    }

    public function test_postal_repair_preserves_schedules_and_rolls_back_unavailable_configuration(): void
    {
        $this->seedNetwork();
        $actor = User::where('email', 'logistics.luzon01@example.com')->firstOrFail();
        $hub = $actor->logisticsOrganization->hub;
        $plan = SortingPlan::where('logistics_hub_id', $hub->id)->where('is_active', true)->firstOrFail();
        HubServiceArea::create(['logistics_hub_id' => $hub->id, 'postal_code' => '1200',
            'is_active' => true, 'revision' => 1, 'created_by' => $actor->id]);
        $versions = app(SortingVersionService::class);
        $schedule = $versions->action($actor, $plan, 'schedule', [
            'expected_revision' => $plan->revision, 'version_id' => $plan->active_version_id,
            'scheduled_for' => now()->addDay()->toIso8601String(),
        ], (string) Str::uuid());
        $warnings = [];
        $warn = function ($message) use (&$warnings): void {
            $warnings[] = $message;
        };
        $repair = app(RegionalPostalLaneSeeder::class);
        $before = $plan->fresh()->toArray();
        $repair->repair($hub, $warn);
        $this->assertSame($before, $plan->fresh()->toArray());
        $this->assertCount(1, $warnings);
        $this->assertDatabaseMissing('sorting_lanes', ['logistics_hub_id' => $hub->id, 'code' => 'POSTAL-1200']);
        $versions->action($actor, $plan, 'cancel', [
            'expected_revision' => $plan->fresh()->revision, 'activation_id' => $schedule['activation']['id'],
        ], (string) Str::uuid());

        // A failed publication must roll back its new lane, draft and revision.
        HubConnection::where('from_hub_id', $hub->id)->firstOrFail()->update(['is_active' => false]);
        $before = $plan->fresh()->toArray();
        $mappings = $plan->lanes()->get()->toArray();
        $repair->repair($hub, $warn);
        $this->assertCount(2, $warnings);
        $this->assertSame($before, $plan->fresh()->toArray());
        $this->assertSame($mappings, $plan->lanes()->get()->toArray());
        $this->assertSame(1, $plan->versions()->count());
        $this->assertDatabaseMissing('sorting_lanes', ['logistics_hub_id' => $hub->id, 'code' => 'POSTAL-1200']);
    }

    private function seedNetwork(): void
    {
        Http::preventStrayRequests();
        User::firstOrCreate(['email' => 'regional-admin@example.com', 'role' => UserRole::Admin], [
            'password' => 'admin-test-secret', 'status' => UserStatus::Active, 'email_verified_at' => now(),
        ]);
        config(['hub-routing.enabled' => true]);
        $this->seed(PhilippinesLogisticsSeeder::class);
    }
}
