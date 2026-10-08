<?php

namespace Database\Seeders\PhilippinesLogistics;

use App\Enums\Logistics\CompanyTruckAvailability;
use App\Enums\Logistics\SortingDestinationType;
use App\Enums\Logistics\SortingLaneType;
use App\Models\CompanyTruck;
use App\Models\HubConnection;
use App\Models\HubServiceArea;
use App\Models\LogisticsHub;
use App\Models\SortingLane;
use App\Models\SortingPlan;
use App\Services\Logistics\Sorting\SortingVersionService;
use Illuminate\Support\Str;

class RegionalNetworkSeeder
{
    private const PLAN_NAME = 'Philippines regional network';

    /**
     * Nearby corridors, approximate route km and elapsed hours including RoRo.
     * These development inputs are not live Geoapify measurements or timetables.
     * Each pair produces two independently accepted directed connections.
     */
    public static function corridors(): array
    {
        return [
            ['ncr', 'region-3', 80, 3, 'NLEX / San Fernando'],
            ['ncr', 'region-4a', 70, 3, 'SLEX / Calamba'],
            ['region-3', 'region-1', 220, 5, 'SCTEX / TPLEX / Manila North Road'],
            ['region-3', 'car', 230, 6, 'TPLEX / Marcos Highway'],
            ['region-3', 'region-2', 440, 10, 'NLEX / Nueva Ecija / Dalton Pass / AH26'],
            ['region-1', 'car', 65, 2.5, 'Naguilian Road'],
            ['region-4a', 'region-4b', 120, 6, 'Batangas–Calapan RoRo'],
            ['region-4a', 'region-5', 460, 10, 'AH26 / Quezon / Camarines / Albay'],
            ['region-4b', 'region-6', 430, 14, 'Calapan–Roxas / Roxas–Caticlan RoRo / Iloilo'],
            ['region-5', 'region-8', 350, 11, 'Matnog–Dapdap RoRo / AH26 / San Juanico'],
            ['region-6', 'nir', 75, 4, 'Dumangas–Banago RoRo'],
            ['nir', 'region-7', 220, 8, 'Bacolod–San Carlos / San Carlos–Toledo RoRo / Mandaue'],
            ['region-7', 'region-8', 230, 9, 'Cebu–Ormoc RoRo / Ormoc–Tacloban'],
            ['region-8', 'region-13', 400, 13, 'Tacloban–Liloan / Liloan–Lipata RoRo / Butuan'],
            ['region-13', 'region-10', 210, 5, 'Butuan–Gingoog–Cagayan de Oro coastal road'],
            ['region-13', 'region-11', 310, 7, 'AH26 / Agusan del Sur / Tagum'],
            ['region-10', 'region-11', 290, 7, 'Bukidnon / Buda / Davao'],
            ['region-10', 'barmm', 240, 6, 'Iligan / Malabang / Sultan Kudarat'],
            ['region-11', 'region-12', 150, 4, 'Davao–Digos–General Santos'],
            ['region-12', 'barmm', 190, 5, 'General Santos–Koronadal–Tacurong–Cotabato corridor'],
            ['region-9', 'barmm', 420, 11, 'Zamboanga–Pagadian–Malabang–Sultan Kudarat'],
        ];
    }

    /** @param array<string, LogisticsHub> $hubs */
    public function connect(array $hubs): void
    {
        foreach (self::corridors() as [$from, $to, $km, $hours]) {
            foreach ([[$from, $to], [$to, $from]] as [$source, $target]) {
                $edge = HubConnection::firstOrCreate([
                    'from_hub_id' => $hubs[$source]->id,
                    'to_hub_id' => $hubs[$target]->id,
                ], [
                    'is_active' => true,
                    'sender_requested' => true,
                    'receiver_accepted' => true,
                    'revision' => 1,
                    'created_by' => $hubs[$source]->organization->user_id,
                ]);
                if ($edge->wasRecentlyCreated) {
                    // Metric columns deliberately are not client mass-assignable.
                    $edge->forceFill(['distance_meters' => $km * 1000, 'duration_seconds' => $hours * 3600])->save();
                }
            }
        }
    }

    public function configure(LogisticsHub $hub, array $definition, int $number, callable $warn): void
    {
        $actor = $hub->organization->user;
        foreach ([['Isuzu', 'NPR closed van', 250], ['Hino', '300 closed van', 500]] as $index => [$make, $model, $capacity]) {
            CompanyTruck::firstOrCreate(['plate_number' => sprintf('PHL-%02d-%02d', $number, $index + 1)], [
                'logistics_organization_id' => $hub->logistics_organization_id,
                'home_hub_id' => $hub->id,
                'last_confirmed_hub_id' => $hub->id,
                'make' => $make,
                'model' => $model,
                'max_parcels' => $capacity,
                'is_active' => true,
                'availability' => CompanyTruckAvailability::Available,
                'revision' => 1,
            ]);
        }

        $coverage = HubServiceArea::firstOrCreate([
            'logistics_hub_id' => $hub->id, 'postal_code' => $definition['postal_code'],
        ], ['is_active' => true, 'revision' => 1, 'created_by' => $actor->id]);

        app(RegionalPostalLaneSeeder::class)->repair($hub, $warn);

        // Never rewrite this fixture's operator-edited draft or immutable history.
        if (SortingPlan::where('logistics_hub_id', $hub->id)->where('name', self::PLAN_NAME)->exists()) {

            return;
        }
        $hasExistingPlans = SortingPlan::where('logistics_hub_id', $hub->id)->exists();
        if (! $coverage->is_active || $actor->status->value !== 'active') {
            $warn("Preserved inactive coverage/account at {$definition['slug']}; regional plan was not activated.");

            return;
        }

        $local = HubServiceArea::where('logistics_hub_id', $hub->id)->where('is_active', true)
            ->orderBy('postal_code')->get()->map(fn ($area, $index) => [$area, $this->lane(
                $hub, $area->postal_code === $definition['postal_code'] ? 'LOCAL' : 'POSTAL-'.$area->postal_code,
                'Local delivery '.$area->postal_code, SortingLaneType::Standard, $index + 1,
            )]);
        $exception = $this->lane($hub, 'EXCEPTION', 'Exception review', SortingLaneType::Exception, $local->count() + 1);
        $outgoing = HubConnection::where('from_hub_id', $hub->id)->where('is_active', true)
            ->where('receiver_accepted', true)->whereHas('toHub.organization.user', fn ($q) => $q->where('status', 'active'))
            ->with('toHub')->orderBy('to_hub_id')->get();
        $lanes = [];
        foreach ($outgoing as $index => $edge) {
            $lanes[] = [$edge, $this->lane($hub, 'TRANSFER-'.strtoupper(substr(hash('sha256', $edge->to_hub_id), 0, 12)),
                'Transfer to '.$edge->toHub->name, SortingLaneType::Standard, $local->count() + $index + 2)];
        }
        if ($local->contains(fn ($pair) => ! $pair[1]->is_active || $pair[1]->type !== SortingLaneType::Standard)
            || ! $exception->is_active || $exception->type !== SortingLaneType::Exception
            || $exception->operational_state->value !== 'open'
            || collect($lanes)->contains(fn ($pair) => ! $pair[1]->is_active || $pair[1]->type !== SortingLaneType::Standard)) {
            $warn("Preserved unavailable physical lanes at {$definition['slug']}; no plan was published.");

            return;
        }

        $plan = SortingPlan::create([
            'logistics_organization_id' => $hub->logistics_organization_id,
            'logistics_hub_id' => $hub->id,
            'created_by_logistics_id' => $actor->id,
            'name' => self::PLAN_NAME, 'is_active' => false, 'revision' => 1,
        ]);
        foreach ($local as [$area, $lane]) {
            $plan->lanes()->create([
                'sorting_lane_id' => $lane->id, 'destination_type' => SortingDestinationType::PostalCode,
                'postal_code' => $area->postal_code, 'position' => $lane->position,
            ]);
        }
        foreach ($lanes as [$edge, $lane]) {
            $plan->lanes()->create([
                'sorting_lane_id' => $lane->id, 'destination_type' => SortingDestinationType::Hub,
                'destination_hub_id' => $edge->to_hub_id, 'position' => $lane->position,
            ]);
        }
        app(SortingVersionService::class)->action($actor, $plan, 'publish', [
            'expected_revision' => 1, 'activate' => ! $hasExistingPlans,
        ], (string) Str::uuid());
        if ($hasExistingPlans) {
            $warn("Added an inactive published regional plan at {$definition['slug']}; existing plans/activation were preserved. Review before activation.");
        }
    }

    private function lane(LogisticsHub $hub, string $code, string $name, SortingLaneType $type, int $position): SortingLane
    {
        return SortingLane::firstOrCreate([
            'logistics_organization_id' => $hub->logistics_organization_id,
            'logistics_hub_id' => $hub->id, 'code' => $code,
        ], [
            'created_by_logistics_id' => $hub->organization->user_id,
            'name' => $name, 'type' => $type, 'is_active' => true, 'position' => $position, 'revision' => 1,
        ]);
    }
}
