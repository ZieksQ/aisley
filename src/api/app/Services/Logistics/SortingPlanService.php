<?php

namespace App\Services\Logistics;

use App\Enums\Logistics\SortingLaneType;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\LogisticsHub;
use App\Models\LogisticsOrganization;
use App\Models\Shipment;
use App\Models\SortingLane;
use App\Models\SortingPlan;
use App\Models\SortingPlanLane;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class SortingPlanService
{
    /** @return array<string, mixed> */
    public function overview(User $logistics): array
    {
        $org = $this->organization($logistics);
        $plans = SortingPlan::query()
            ->where('logistics_organization_id', $org->id)
            ->where('logistics_hub_id', $org->hub->id)
            ->with('lanes.lane')
            ->orderByDesc('is_active')
            ->orderBy('name')
            ->get();

        return [
            'context' => ['organization_id' => $org->id, 'hub_id' => $org->hub->id, 'hub_name' => $org->hub->name],
            'active_plan_id' => $plans->firstWhere('is_active', true)?->id,
            'plans' => $plans->map(fn (SortingPlan $plan): array => $this->planProjection($plan))->values()->all(),
            'lanes' => $this->lanes($org),
        ];
    }

    public function createPlan(User $logistics, array $input): SortingPlan
    {
        $org = $this->organization($logistics);
        $name = trim((string) $input['name']);

        return DB::transaction(function () use ($logistics, $org, $name, $input): SortingPlan {
            $this->lockHub($org);
            $this->assertUniquePlanName($org, $name);
            $activate = array_key_exists('is_active', $input)
                ? (bool) $input['is_active']
                : ! $this->plans($org)->where('is_active', true)->exists();
            if ($activate) {
                $this->deactivateOtherPlans($org);
            }

            return SortingPlan::create([
                'logistics_organization_id' => $org->id,
                'logistics_hub_id' => $org->hub->id,
                'created_by_logistics_id' => $logistics->id,
                'name' => $name,
                'is_active' => $activate,
                'revision' => 1,
            ])->load('lanes.lane');
        }, 3);
    }

    public function updatePlan(User $logistics, SortingPlan $plan, array $input): SortingPlan
    {
        $org = $this->organization($logistics);

        return DB::transaction(function () use ($org, $plan, $input): SortingPlan {
            $this->lockHub($org);
            $owned = $this->ownedPlan($org, $plan->id, true);
            if ($owned->revision !== (int) $input['expected_revision']) {
                throw FulfillmentException::conflict('SORT_PLAN_REVISION_CONFLICT', 'The sort plan changed. Refresh before editing it.');
            }
            $name = array_key_exists('name', $input) ? trim((string) $input['name']) : $owned->name;
            if ($name !== $owned->name) {
                $this->assertUniquePlanName($org, $name, $owned->id);
            }
            $active = array_key_exists('is_active', $input) ? (bool) $input['is_active'] : $owned->is_active;
            if ($active) {
                $this->deactivateOtherPlans($org, $owned->id);
            }
            $owned->update([
                'name' => $name,
                'is_active' => $active,
                'revision' => $owned->revision + 1,
            ]);

            return $owned->fresh('lanes.lane');
        }, 3);
    }

    public function addLane(User $logistics, SortingPlan $plan, array $input): SortingPlan
    {
        $org = $this->organization($logistics);
        $postalCode = $this->normalizePostalCode((string) $input['postal_code']);
        if ($postalCode === null) {
            throw FulfillmentException::invalid('SORT_PLAN_POSTAL_CODE_INVALID', 'Enter a valid four-digit postal code.', 'postal_code');
        }

        return DB::transaction(function () use ($org, $plan, $input, $postalCode): SortingPlan {
            $this->lockHub($org);
            $owned = $this->ownedPlan($org, $plan->id, true);
            if ($owned->revision !== (int) $input['expected_revision']) {
                throw FulfillmentException::conflict('SORT_PLAN_REVISION_CONFLICT', 'The sort plan changed. Refresh before adding a postal code.');
            }
            $lane = SortingLane::query()
                ->whereKey($input['sorting_lane_id'] ?? $input['lane_id'])
                ->where('logistics_organization_id', $org->id)
                ->where('logistics_hub_id', $org->hub->id)
                ->lockForUpdate()
                ->first();
            if ($lane === null) {
                throw FulfillmentException::notFound('SORT_LANE_NOT_FOUND', 'This sorting lane is unavailable.');
            }
            if (! $lane->is_active || $lane->type !== SortingLaneType::Standard) {
                throw FulfillmentException::invalid('SORT_PLAN_STANDARD_LANE_REQUIRED', 'Postal-code mappings require an active standard lane.', 'lane_id');
            }
            if ($owned->lanes()->where('postal_code', $postalCode)->exists()) {
                throw FulfillmentException::invalid('SORT_PLAN_POSTAL_CODE_TAKEN', 'This postal code is already mapped in the sort plan.', 'postal_code');
            }

            $owned->lanes()->create([
                'sorting_lane_id' => $lane->id,
                'postal_code' => $postalCode,
                'position' => (int) ($input['position'] ?? 1),
            ]);
            $owned->update(['revision' => $owned->revision + 1]);

            return $owned->fresh('lanes.lane');
        }, 3);
    }

    public function removeLane(User $logistics, SortingPlan $plan, SortingPlanLane $planLane, int $expectedRevision): SortingPlan
    {
        $org = $this->organization($logistics);

        return DB::transaction(function () use ($org, $plan, $planLane, $expectedRevision): SortingPlan {
            $this->lockHub($org);
            $owned = $this->ownedPlan($org, $plan->id, true);
            if ($owned->revision !== $expectedRevision) {
                throw FulfillmentException::conflict('SORT_PLAN_REVISION_CONFLICT', 'The sort plan changed. Refresh before removing a postal code.');
            }
            $mapping = $owned->lanes()->whereKey($planLane->id)->lockForUpdate()->first();
            if ($mapping === null) {
                throw FulfillmentException::notFound('SORT_PLAN_LANE_NOT_FOUND', 'This sort-plan postal-code mapping is unavailable.');
            }
            $mapping->delete();
            $owned->update(['revision' => $owned->revision + 1]);

            return $owned->fresh('lanes.lane');
        }, 3);
    }

    /**
     * Resolve the current active plan for one destination. A null lane is
     * intentional: the caller must route it to the active exception lane.
     *
     * @return array{plan: SortingPlan|null, plan_lane: SortingPlanLane|null, lane: SortingLane|null, postal_code: string|null, reason: string}
     */
    public function routeForContext(string $organizationId, string $hubId, ?string $postalCode): array
    {
        $normalized = $postalCode === null ? null : $this->normalizePostalCode($postalCode);
        $plan = SortingPlan::query()
            ->where('logistics_organization_id', $organizationId)
            ->where('logistics_hub_id', $hubId)
            ->where('is_active', true)
            ->with('lanes.lane')
            ->first();
        if ($plan === null) {
            return ['plan' => null, 'plan_lane' => null, 'lane' => null, 'postal_code' => $normalized, 'reason' => 'no_active_plan'];
        }
        if ($normalized === null) {
            return ['plan' => $plan, 'plan_lane' => null, 'lane' => null, 'postal_code' => null, 'reason' => 'postal_code_missing'];
        }
        $mapping = $plan->lanes->firstWhere('postal_code', $normalized);
        if ($mapping === null) {
            return ['plan' => $plan, 'plan_lane' => null, 'lane' => null, 'postal_code' => $normalized, 'reason' => 'postal_code_not_mapped'];
        }
        $lane = $mapping->lane;
        if ($lane === null || ! $lane->is_active || $lane->type !== SortingLaneType::Standard) {
            return ['plan' => $plan, 'plan_lane' => $mapping, 'lane' => null, 'postal_code' => $normalized, 'reason' => 'mapped_lane_unavailable'];
        }

        return ['plan' => $plan, 'plan_lane' => $mapping, 'lane' => $lane, 'postal_code' => $normalized, 'reason' => 'matched'];
    }

    /** @return array{plan: SortingPlan|null, plan_lane: SortingPlanLane|null, lane: SortingLane|null, postal_code: string|null, reason: string} */
    public function routeForShipment(Shipment $shipment): array
    {
        $shipment->loadMissing('parcel.order.address');

        return $this->routeForContext(
            (string) $shipment->logistics_organization_id,
            (string) $shipment->logistics_hub_id,
            $shipment->parcel?->order?->address?->postal_code,
        );
    }

    /** @return array<string, mixed> */
    public function routingSnapshot(string $organizationId, string $hubId, ?string $postalCode): array
    {
        $routing = $this->routeForContext($organizationId, $hubId, $postalCode);
        $lane = $routing['lane'];

        return [
            'plan_id' => $routing['plan']?->id,
            'plan_name' => $routing['plan']?->name,
            'plan_revision' => $routing['plan']?->revision,
            'postal_code' => $routing['postal_code'],
            'lane_id' => $lane?->id,
            'lane_code' => $lane?->code,
            'lane_name' => $lane?->name,
            'matched' => $routing['reason'] === 'matched',
            'reason' => $routing['reason'],
        ];
    }

    public function exceptionLaneForContext(string $organizationId, string $hubId): ?SortingLane
    {
        return SortingLane::query()
            ->where('logistics_organization_id', $organizationId)
            ->where('logistics_hub_id', $hubId)
            ->where('type', SortingLaneType::Exception->value)
            ->where('is_active', true)
            ->orderBy('position')
            ->orderBy('code')
            ->first();
    }

    /** @return array<string, mixed> */
    public function planProjection(SortingPlan $plan): array
    {
        $plan->loadMissing('lanes.lane');

        return [
            'id' => $plan->id,
            'name' => $plan->name,
            'is_active' => $plan->is_active,
            'revision' => $plan->revision,
            'created_at' => $plan->created_at?->toISOString(),
            'updated_at' => $plan->updated_at?->toISOString(),
            'lanes' => $plan->lanes->map(fn (SortingPlanLane $mapping): array => [
                'id' => $mapping->id,
                'postal_code' => $mapping->postal_code,
                'position' => $mapping->position,
                'lane' => $mapping->lane ? $this->laneProjection($mapping->lane) : null,
            ])->values()->all(),
        ];
    }

    /** @return array<string, mixed> */
    public function laneProjection(SortingLane $lane): array
    {
        return [
            'id' => $lane->id,
            'code' => $lane->code,
            'name' => $lane->name,
            'type' => $lane->type->value,
            'is_active' => $lane->is_active,
            'position' => $lane->position,
            'revision' => $lane->revision,
            'label_payload' => 'AISLEY:SORT-LANE:1:'.$lane->id,
            'label_url' => '/api/v1/logistics/sorting/lanes/'.$lane->id.'/label',
        ];
    }

    public function normalizePostalCode(string $postalCode): ?string
    {
        $normalized = preg_replace('/[\s-]+/', '', trim($postalCode));

        return is_string($normalized) && preg_match('/^\d{4}$/', $normalized) === 1 ? $normalized : null;
    }

    private function organization(User $logistics): LogisticsOrganization
    {
        $org = $logistics->logisticsOrganization()->with('hub')->first();
        if ($org === null || $org->hub === null) {
            throw FulfillmentException::notFound('LOGISTICS_CONTEXT_NOT_FOUND', 'The Logistics organization or operational hub is unavailable.');
        }

        return $org;
    }

    private function lockHub(LogisticsOrganization $org): LogisticsHub
    {
        return LogisticsHub::query()->whereKey($org->hub->id)->lockForUpdate()->firstOrFail();
    }

    private function ownedPlan(LogisticsOrganization $org, string $planId, bool $lock = false): SortingPlan
    {
        $query = SortingPlan::query()
            ->whereKey($planId)
            ->where('logistics_organization_id', $org->id)
            ->where('logistics_hub_id', $org->hub->id);
        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->first() ?? throw FulfillmentException::notFound('SORT_PLAN_NOT_FOUND', 'This sort plan is unavailable.');
    }

    private function assertUniquePlanName(LogisticsOrganization $org, string $name, ?string $except = null): void
    {
        $exists = $this->plans($org)
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->when($except, fn ($query) => $query->whereKeyNot($except))
            ->exists();
        if ($exists) {
            throw FulfillmentException::invalid('SORT_PLAN_NAME_TAKEN', 'A sort plan already uses this name.', 'name');
        }
    }

    private function deactivateOtherPlans(LogisticsOrganization $org, ?string $except = null): void
    {
        $this->plans($org)
            ->where('is_active', true)
            ->when($except, fn ($query) => $query->whereKeyNot($except))
            ->update(['is_active' => false, 'revision' => DB::raw('revision + 1')]);
    }

    private function plans(LogisticsOrganization $org)
    {
        return SortingPlan::query()
            ->where('logistics_organization_id', $org->id)
            ->where('logistics_hub_id', $org->hub->id);
    }

    /** @return array<int, array<string, mixed>> */
    private function lanes(LogisticsOrganization $org): array
    {
        return SortingLane::query()
            ->where('logistics_organization_id', $org->id)
            ->where('logistics_hub_id', $org->hub->id)
            ->orderBy('position')
            ->orderBy('code')
            ->get()
            ->map(fn (SortingLane $lane): array => $this->laneProjection($lane))
            ->all();
    }
}
