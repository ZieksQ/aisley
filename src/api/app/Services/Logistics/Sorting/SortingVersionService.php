<?php

namespace App\Services\Logistics\Sorting;

use App\Enums\Logistics\SortingActivationStatus;
use App\Enums\Logistics\SortingLaneType;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\HubConnection;
use App\Models\SortingLane;
use App\Models\SortingPlan;
use App\Models\SortingPlanActivation;
use App\Models\SortingPlanVersion;
use App\Models\User;
use App\Services\Logistics\SortingPlanService;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class SortingVersionService
{
    public function owned(User $actor, string $planId): SortingPlan
    {
        $org = $actor->logisticsOrganization()->with('hub')->first();

        return SortingPlan::query()->whereKey($planId)->where('logistics_organization_id', $org?->id)
            ->where('logistics_hub_id', $org?->hub?->id)->first()
            ?? throw FulfillmentException::notFound('SORT_PLAN_NOT_FOUND', 'This sort plan is unavailable.');
    }

    public function action(User $actor, SortingPlan $plan, string $action, array $input, string $key): array
    {
        $owned = $this->owned($actor, $plan->id);

        return DB::transaction(function () use ($actor, $owned, $action, $input, $key): array {
            SortingLocks::hub($owned->logistics_hub_id);
            $this->recoverHubLocked($owned->logistics_hub_id);

            return app(SortingMutationService::class)->run($actor, $key, ['plan_id' => $owned->id, 'action' => $action, ...$input], function () use ($actor, $owned, $action, $input): array {
                $plan = $owned->fresh('lanes');
                if ($plan->revision !== (int) $input['expected_revision']) {
                    throw FulfillmentException::conflict('SORT_PLAN_REVISION_CONFLICT', 'Refresh the plan before continuing.');
                }
                if ($plan->archived_at !== null) {
                    throw FulfillmentException::conflict('SORT_PLAN_ARCHIVED', 'An archived plan is read-only.');
                }
                $version = isset($input['version_id']) ? SortingPlanVersion::query()->whereKey($input['version_id'])->where('sorting_plan_id', $plan->id)->first() : null;
                if (isset($input['version_id']) && $version === null) {
                    throw FulfillmentException::notFound('SORT_VERSION_NOT_FOUND', 'This plan version is unavailable.');
                }
                $extra = [];
                switch ($action) {
                    case 'draft':
                        $version ??= $plan->versions()->first();
                        if ($plan->draft_dirty) {
                            throw FulfillmentException::conflict('SORT_DRAFT_EXISTS', 'Finish the existing draft before creating a successor.');
                        }
                        $plan->lanes()->delete();
                        foreach ($version?->mappings ?? [] as $mapping) {
                            unset($mapping['id']);
                            $plan->lanes()->create($mapping);
                        }
                        $plan->update(['draft_dirty' => true, 'revision' => $plan->revision + 1]);
                        break;
                    case 'duplicate':
                        if ($version === null) {
                            throw FulfillmentException::invalid('SORT_VERSION_REQUIRED', 'Select a published version to duplicate.');
                        }
                        $name = trim($input['name']);
                        if (SortingPlan::query()->where('logistics_hub_id', $plan->logistics_hub_id)->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->exists()) {
                            throw FulfillmentException::invalid('SORT_PLAN_NAME_TAKEN', 'A plan already uses this name.', 'name');
                        }
                        $copy = SortingPlan::create(['logistics_organization_id' => $plan->logistics_organization_id,
                            'logistics_hub_id' => $plan->logistics_hub_id, 'created_by_logistics_id' => $actor->id,
                            'name' => $name, 'is_active' => false, 'revision' => 1, 'draft_dirty' => true]);
                        foreach ($version->mappings as $mapping) {
                            unset($mapping['id']);
                            $copy->lanes()->create($mapping);
                        }
                        $plan = $copy;
                        break;
                    case 'publish':
                        if (! $plan->draft_dirty) {
                            throw FulfillmentException::conflict('SORT_DRAFT_REQUIRED', 'Create or edit a successor draft first.');
                        }
                        $mappings = $plan->lanes->map(fn ($mapping) => [...$mapping->only(['id', 'sorting_lane_id', 'destination_hub_id', 'postal_code', 'position']), 'destination_type' => $mapping->destination_type->value])->all();
                        $this->validateMappings($plan, $mappings);
                        $previous = $plan->versions()->first();
                        $version = SortingPlanVersion::create(['sorting_plan_id' => $plan->id, 'number' => ($previous?->number ?? 0) + 1,
                            'name' => $plan->name, 'mappings' => $mappings, 'differences' => $this->differences($previous?->mappings ?? [], $mappings),
                            'published_by' => $actor->id, 'published_at' => now()]);
                        $plan->update(['draft_dirty' => false, 'revision' => $plan->revision + 1]);
                        if ($input['activate'] ?? false) {
                            $extra['activation'] = $this->schedule($actor, $plan, $version, now());
                        } elseif (isset($input['scheduled_for'])) {
                            $extra['activation'] = $this->schedule($actor, $plan, $version, $this->time($input['scheduled_for']));
                        }
                        break;
                    case 'activate':
                    case 'schedule':
                        if ($version === null) {
                            throw FulfillmentException::invalid('SORT_VERSION_REQUIRED', 'Select a published version.');
                        }
                        $extra['activation'] = $this->schedule($actor, $plan, $version, $action === 'activate' ? now() : $this->time($input['scheduled_for']));
                        break;
                    case 'cancel':
                        $activation = SortingPlanActivation::query()->whereKey($input['activation_id'])->whereIn('sorting_plan_version_id', $plan->versions()->select('id'))->first();
                        if ($activation === null) {
                            throw FulfillmentException::notFound('SORT_ACTIVATION_NOT_FOUND', 'This activation is unavailable.');
                        }
                        if ($activation->status !== SortingActivationStatus::Scheduled) {
                            throw FulfillmentException::conflict('SORT_ACTIVATION_COMPLETED', 'This activation has already completed.');
                        }
                        $activation->update(['status' => SortingActivationStatus::Cancelled, 'pending_key' => null, 'cancelled_by' => $actor->id, 'completed_at' => now()]);
                        $plan->increment('revision');
                        break;
                    case 'archive':
                        if ($plan->is_active) {
                            throw FulfillmentException::conflict('SORT_ACTIVE_PLAN', 'Activate another plan before archival.');
                        }
                        if (SortingPlanActivation::query()->whereIn('sorting_plan_version_id', $plan->versions()->select('id'))->where('status', 'scheduled')->exists()) {
                            throw FulfillmentException::conflict('SORT_SCHEDULE_PENDING', 'Cancel scheduled activations before archival.');
                        }
                        $plan->update(['archived_at' => now(), 'revision' => $plan->revision + 1]);
                        break;
                }

                return ['plan_id' => $plan->id, 'revision' => $plan->fresh()->revision, 'version' => $version?->toArray(), ...$extra];
            });
        }, 3);
    }

    private function time(string $value): CarbonImmutable
    {
        $time = CarbonImmutable::parse($value, 'Asia/Manila')->utc()->startOfSecond();
        if ($time->lessThanOrEqualTo(now())) {
            throw FulfillmentException::invalid('SORT_SCHEDULE_PAST', 'Select a future activation time in Asia/Manila.', 'scheduled_for');
        }

        return $time;
    }

    private function schedule(User $actor, SortingPlan $plan, SortingPlanVersion $version, $time): array
    {
        $time = $time->utc()->startOfSecond();
        $pendingKey = $plan->logistics_hub_id.':'.$time->format('Y-m-d H:i:s');
        if (SortingPlanActivation::query()->where('pending_key', $pendingKey)->exists()) {
            throw FulfillmentException::conflict('SORT_SCHEDULE_TAKEN', 'Another version is scheduled at this time.');
        }
        $activation = SortingPlanActivation::create(['sorting_plan_version_id' => $version->id, 'logistics_hub_id' => $plan->logistics_hub_id,
            'requested_by' => $actor->id, 'scheduled_for' => $time, 'pending_key' => $pendingKey, 'status' => SortingActivationStatus::Scheduled]);
        $plan->increment('revision');
        $this->recoverHubLocked($plan->logistics_hub_id);

        return $activation->fresh()->toArray();
    }

    /** Authoritative reads also recover overdue selections, even when the scheduler is delayed. */
    public function recoverHub(string $hubId): void
    {
        DB::transaction(function () use ($hubId): void {
            SortingLocks::hub($hubId);
            $this->recoverHubLocked($hubId);
        }, 3);
    }

    public function recoverHubLocked(string $hubId): void
    {
        $due = SortingPlanActivation::query()->where('logistics_hub_id', $hubId)->where('status', SortingActivationStatus::Scheduled)
            ->where('scheduled_for', '<=', now())->orderBy('scheduled_for')->orderBy('id')->lockForUpdate()->get();
        foreach ($due as $activation) {
            $version = SortingPlanVersion::findOrFail($activation->sorting_plan_version_id);
            $plan = SortingPlan::findOrFail($version->sorting_plan_id);
            try {
                if ($plan->archived_at !== null) {
                    throw FulfillmentException::conflict('SORT_PLAN_ARCHIVED', 'The plan is archived.');
                }
                $this->validateMappings($plan, $version->mappings);
            } catch (FulfillmentException $exception) {
                $activation->update(['status' => SortingActivationStatus::Failed, 'failure_reason' => $exception->getMessage(), 'pending_key' => null, 'completed_at' => now()]);

                continue;
            }
            SortingPlan::query()->where('logistics_hub_id', $hubId)->where('is_active', true)->update(['is_active' => false, 'active_version_id' => null, 'revision' => DB::raw('revision + 1')]);
            $plan->fresh()->update(['is_active' => true, 'active_version_id' => $version->id, 'revision' => $plan->fresh()->revision + 1]);
            $activation->update(['status' => SortingActivationStatus::Activated, 'pending_key' => null, 'completed_at' => now()]);
        }
    }

    private function validateMappings(SortingPlan $plan, array $mappings): void
    {
        if ($mappings === []) {
            throw FulfillmentException::invalid('SORT_MAPPING_REQUIRED', 'Add at least one destination mapping before publication or activation.');
        }
        $exception = app(SortingPlanService::class)->exceptionLaneForContext($plan->logistics_organization_id, $plan->logistics_hub_id);
        if ($exception === null) {
            throw FulfillmentException::invalid('SORT_EXCEPTION_LANE_REQUIRED', 'Configure an open exception lane before publication or activation.');
        }
        foreach ($mappings as $mapping) {
            if (! SortingLane::query()->whereKey($mapping['sorting_lane_id'])->where('logistics_organization_id', $plan->logistics_organization_id)->where('logistics_hub_id', $plan->logistics_hub_id)->where('is_active', true)->where('type', SortingLaneType::Standard)->exists()) {
                throw FulfillmentException::invalid('SORT_VERSION_LANE_UNAVAILABLE', 'A mapped physical lane is inactive or unavailable.');
            }
            if ($mapping['destination_type'] === 'hub' && ! HubConnection::query()->where('from_hub_id', $plan->logistics_hub_id)->where('to_hub_id', $mapping['destination_hub_id'])->where('is_active', true)->where('receiver_accepted', true)->whereHas('toHub.organization.user', fn ($q) => $q->where('status', 'active'))->exists()) {
                throw FulfillmentException::invalid('SORT_VERSION_CONNECTION_UNAVAILABLE', 'A mapped hub connection is unavailable.');
            }
        }
    }

    private function differences(array $before, array $after): array
    {
        $key = fn ($m) => $m['destination_type'].':'.($m['destination_hub_id'] ?? $m['postal_code']);
        $old = collect($before)->keyBy($key);
        $new = collect($after)->keyBy($key);

        return ['added' => $new->diffKeys($old)->values()->all(), 'removed' => $old->diffKeys($new)->values()->all(),
            'changed' => $new->filter(fn ($m, $k) => $old->has($k) && ($old[$k]['sorting_lane_id'] !== $m['sorting_lane_id'] || $old[$k]['position'] !== $m['position']))->map(fn ($m, $k) => ['before' => $old[$k], 'after' => $m])->values()->all()];
    }
}
