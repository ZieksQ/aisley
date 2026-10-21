<?php

namespace Tests\Feature;

use App\Enums\Logistics\SortingLaneType;
use App\Models\HubServiceArea;
use App\Models\SortingLane;
use App\Models\SortingPlan;
use App\Services\Logistics\Routing\CheckoutRoutePlanner;
use App\Services\Logistics\Sorting\SortingVersionService;
use Database\Seeders\PhilippinesLogistics\RegionalAccountSeeder;
use Database\Seeders\PhilippinesLogistics\RegionalHubCatalog;
use Database\Seeders\PhilippinesLogistics\RegionalPostalCatalog;
use Database\Seeders\PhilippinesLogisticsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class RegionalPostalCoverageTest extends TestCase
{
    use RefreshDatabase;

    public function test_production_opt_in_expands_an_existing_plan_with_named_postal_lanes_and_preserves_history(): void
    {
        Http::preventStrayRequests();
        config(['demo.allow_seeders_in_production' => true, 'hub-routing.enabled' => true]);
        $definition = collect(RegionalHubCatalog::hubs())->firstWhere('slug', 'region-4a');
        $hub = app(RegionalAccountSeeder::class)->seed($definition, 6);
        $hub->load('organization.user');
        $actor = $hub->organization->user;
        foreach (['4027' => true, '4034' => false] as $postal => $active) {
            HubServiceArea::create(['logistics_hub_id' => $hub->id, 'postal_code' => (string) $postal,
                'is_active' => $active, 'revision' => 3, 'created_by' => $actor->id]);
        }
        $local = SortingLane::create([
            'logistics_organization_id' => $hub->logistics_organization_id, 'logistics_hub_id' => $hub->id,
            'created_by_logistics_id' => $actor->id, 'code' => 'LOCAL', 'name' => 'Operator Calamba lane',
            'type' => SortingLaneType::Standard, 'is_active' => true, 'position' => 1, 'revision' => 4,
        ]);
        SortingLane::create([
            'logistics_organization_id' => $hub->logistics_organization_id, 'logistics_hub_id' => $hub->id,
            'created_by_logistics_id' => $actor->id, 'code' => 'EXCEPTION', 'name' => 'Exception review',
            'type' => SortingLaneType::Exception, 'is_active' => true, 'position' => 2, 'revision' => 1,
        ]);
        $plan = SortingPlan::create([
            'logistics_organization_id' => $hub->logistics_organization_id, 'logistics_hub_id' => $hub->id,
            'created_by_logistics_id' => $actor->id, 'name' => 'Existing operator plan', 'revision' => 1,
        ]);
        $plan->lanes()->create(['sorting_lane_id' => $local->id, 'destination_type' => 'postal_code',
            'postal_code' => '4027', 'position' => 1]);
        app(SortingVersionService::class)->action($actor, $plan, 'publish', [
            'expected_revision' => 1, 'activate' => true,
        ], (string) Str::uuid());
        $original = $plan->fresh()->activeVersion;
        $history = $original->toArray();
        $environment = app()->environment();
        app()->detectEnvironment(fn () => 'production');

        try {
            app(PhilippinesLogisticsSeeder::class)->run();

            $this->assertDatabaseCount('hub_service_areas', 1992);
            $active = $plan->fresh()->activeVersion;
            $postal = collect($active->mappings)->where('destination_type', 'postal_code')->keyBy('postal_code');
            $this->assertCount(count(RegionalPostalCatalog::forRegion('region-4a')) - 1, $postal);
            $this->assertSame($local->id, $postal['4027']['sorting_lane_id']);
            $this->assertSame('Operator Calamba lane', $local->fresh()->name);
            $this->assertSame(4, $local->fresh()->revision);
            $this->assertFalse($postal->has('4034'));
            $this->assertDatabaseHas('hub_service_areas', ['logistics_hub_id' => $hub->id,
                'postal_code' => '4034', 'is_active' => false, 'revision' => 3]);
            $this->assertDatabaseHas('sorting_lanes', ['id' => $postal['4009']['sorting_lane_id'],
                'logistics_hub_id' => $hub->id, 'name' => 'Santa Cruz Lane', 'code' => 'STC-01']);
            $this->assertSame('local', app(CheckoutRoutePlanner::class)->plan($hub, '4009')['status']);
            $this->assertSame($history, $original->fresh()->toArray());
            $this->assertSame(2, $active->number);
            $laneCount = SortingLane::count();

            app(PhilippinesLogisticsSeeder::class)->run();

            $this->assertSame($active->id, $plan->fresh()->active_version_id);
            $this->assertSame(2, $plan->versions()->count());
            $this->assertSame($laneCount, SortingLane::count());
            Http::assertNothingSent();
        } finally {
            app()->detectEnvironment(fn () => $environment);
        }
    }
}
