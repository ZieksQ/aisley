<?php

namespace Database\Seeders\PhilippinesLogistics;

use App\Enums\Logistics\SortingLaneState;
use App\Enums\Logistics\SortingLaneType;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\HubServiceArea;
use App\Models\LogisticsHub;
use App\Models\SortingLane;
use App\Models\SortingPlan;
use App\Models\SortingPlanActivation;
use App\Models\SortingPlanVersion;
use App\Services\Logistics\Sorting\SortingLocks;
use App\Services\Logistics\Sorting\SortingVersionService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Complete local coverage without rewriting published routing evidence. */
class RegionalPostalLaneSeeder
{
    public function repair(LogisticsHub $hub, callable $warn): void
    {
        try {
            DB::transaction(function () use ($hub, $warn): void {
                SortingLocks::hub($hub->id);
                $plan = SortingPlan::where('logistics_hub_id', $hub->id)->where('is_active', true)
                    ->with('activeVersion')->first();
                if ($plan?->activeVersion === null || $hub->organization->user->status->value !== 'active') {
                    return;
                }

                $mappings = collect($plan->activeVersion->mappings);
                $uses = $mappings->countBy('sorting_lane_id');
                $postal = $mappings->where('destination_type', 'postal_code')->keyBy('postal_code');
                $codes = HubServiceArea::where('logistics_hub_id', $hub->id)->where('is_active', true)
                    ->orderBy('postal_code')->pluck('postal_code');
                $missing = $codes->filter(fn ($code) => ! $postal->has($code)
                    || $uses[$postal[$code]['sorting_lane_id']] > 1);
                if ($missing->isEmpty()) {
                    return;
                }
                if ($plan->archived_at !== null
                    || SortingPlanActivation::where('logistics_hub_id', $hub->id)->where('status', 'scheduled')->exists()) {
                    $warn("Preserved scheduled sort plan at {$hub->name}; dedicated supported-postal lanes need operator review.");

                    return;
                }

                $position = max((int) SortingLane::where('logistics_hub_id', $hub->id)->max('position'), (int) $mappings->max('position'));
                $lanes = [];
                foreach ($missing as $code) {
                    $lane = SortingLane::firstOrCreate([
                        'logistics_organization_id' => $hub->logistics_organization_id,
                        'logistics_hub_id' => $hub->id, 'code' => 'POSTAL-'.$code,
                    ], [
                        'created_by_logistics_id' => $hub->organization->user_id,
                        'name' => 'Local delivery '.$code, 'type' => SortingLaneType::Standard,
                        'is_active' => true, 'position' => ++$position, 'revision' => 1,
                    ]);
                    if (! $lane->is_active || $lane->type !== SortingLaneType::Standard
                        || $lane->operational_state !== SortingLaneState::Open
                        || $mappings->contains(fn ($mapping) => $mapping['sorting_lane_id'] === $lane->id
                            && ($mapping['destination_type'] !== 'postal_code' || $mapping['postal_code'] !== $code))) {
                        throw FulfillmentException::conflict('SEED_POSTAL_LANE_UNAVAILABLE', "The dedicated lane for {$code} is unavailable or already used by another destination.");
                    }
                    $lanes[$code] = $lane;
                }

                $actor = $hub->organization->user;
                $next = $mappings->keyBy(fn ($mapping) => $this->destination($mapping));
                foreach ($lanes as $code => $lane) {
                    $key = 'postal_code:'.$code;
                    $mapping = [
                        'id' => $next[$key]['id'] ?? (string) Str::uuid(),
                        'destination_type' => 'postal_code', 'postal_code' => (string) $code,
                        'destination_hub_id' => null, 'sorting_lane_id' => $lane->id, 'position' => $lane->position,
                    ];
                    // A clean working copy follows the successor; an operator draft is untouched.
                    if (! $plan->draft_dirty) {
                        $row = $plan->lanes()->updateOrCreate(['destination_type' => 'postal_code', 'postal_code' => (string) $code], [
                            'sorting_lane_id' => $lane->id, 'position' => $lane->position,
                        ]);
                        $mapping['id'] = $row->id;
                    }
                    $next[$key] = $mapping;
                }
                $previous = $mappings->keyBy(fn ($mapping) => $this->destination($mapping));
                // Seed from the selected snapshot independently of any unfinished draft.
                $version = SortingPlanVersion::create([
                    'sorting_plan_id' => $plan->id, 'number' => $plan->versions()->max('number') + 1,
                    'name' => $plan->activeVersion->name,
                    'mappings' => $next->sortBy('position')->values()->all(),
                    'differences' => [
                        'added' => $next->diffKeys($previous)->values()->all(), 'removed' => [],
                        'changed' => $next->filter(fn ($mapping, $key) => $previous->has($key)
                            && $previous[$key]['sorting_lane_id'] !== $mapping['sorting_lane_id'])
                            ->map(fn ($mapping, $key) => ['before' => $previous[$key], 'after' => $mapping])->values()->all(),
                    ],
                    'published_by' => $actor->id, 'published_at' => now(),
                ]);
                $result = app(SortingVersionService::class)->action($actor, $plan, 'activate', [
                    'expected_revision' => $plan->revision, 'version_id' => $version->id,
                ], (string) Str::uuid());
                if ($result['activation']['status'] !== 'activated') {
                    throw FulfillmentException::conflict('SEED_POSTAL_ACTIVATION_FAILED', $result['activation']['failure_reason']);
                }
            });
        } catch (FulfillmentException $exception) {
            // Roll back the whole successor, including newly created lanes.
            $warn("Preserved active sort plan at {$hub->name}; postal-lane repair needs review: {$exception->getMessage()}");
        }
    }

    private function destination(array $mapping): string
    {
        return $mapping['destination_type'].':'.($mapping['destination_hub_id'] ?? $mapping['postal_code']);
    }
}
