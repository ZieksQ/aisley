<?php

namespace App\Services\Courier;

use App\Enums\FirstMileTaskStatus;
use App\Enums\PickupScheduleStatus;
use App\Exceptions\Courier\CourierPickupException;
use App\Models\LogisticsOrganization;
use App\Models\PickupSchedule;
use App\Models\User;
use App\Services\Logistics\ReleasePickupParcels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PickupDecisionService
{
    public function __construct(private readonly ReleasePickupParcels $release) {}

    public function handle(User $courier, string $target, string $action, string $reason, string $key): array
    {
        $hash = hash('sha256', json_encode([$target, $action, $reason], JSON_THROW_ON_ERROR));

        return DB::transaction(function () use ($courier, $target, $action, $reason, $key, $hash): array {
            $affiliation = $courier->courierLogisticsAffiliation()->firstOrFail();
            LogisticsOrganization::query()->whereKey($affiliation->logistics_organization_id)->lockForUpdate()->firstOrFail();
            $schedule = PickupSchedule::query()->where('courier_id', $courier->id)
                ->where('logistics_organization_id', $affiliation->logistics_organization_id)
                ->where('logistics_hub_id', $affiliation->logistics_hub_id)
                ->when($action === 'rejected', fn ($q) => $q->whereKey($target), fn ($q) => $q->whereHas('tasks', fn ($t) => $t->whereKey($target)->where('courier_id', $courier->id)))
                ->lockForUpdate()->firstOrFail();
            $previous = DB::table('pickup_decisions')->where('courier_id', $courier->id)->where('idempotency_key', $key)->first();
            if ($previous) {
                if (! hash_equals($previous->request_hash, $hash)) {
                    throw CourierPickupException::conflict('IDEMPOTENCY_KEY_REUSED', 'This key was used for a different pickup decision.');
                }

                return json_decode($previous->result, true, flags: JSON_THROW_ON_ERROR);
            }
            $tasks = $schedule->tasks()->orderBy('id')->lockForUpdate()->get();
            $task = $action === 'failed_pickup' ? $tasks->firstWhere('id', $target) : null;
            if ($schedule->status !== PickupScheduleStatus::Scheduled || $schedule->retryDeadline()->lte(now())) {
                throw CourierPickupException::conflict('PICKUP_TRANSITION_CONFLICT', 'This pickup schedule is no longer available.');
            }
            if ($action === 'rejected') {
                // An offer is rejectable only before the Courier accepts any parcel or takes custody.
                if ($tasks->contains(fn ($t) => in_array($t->status, [FirstMileTaskStatus::Accepted, FirstMileTaskStatus::PickedUp], true))) {
                    throw CourierPickupException::conflict('PICKUP_TRANSITION_CONFLICT', 'An accepted pickup schedule cannot be rejected.');
                }
                $released = $tasks->where('status', FirstMileTaskStatus::Assigned);
                if ($released->isEmpty()) {
                    throw CourierPickupException::conflict('PICKUP_TRANSITION_CONFLICT', 'There are no offered parcels to reject.');
                }
                $this->release->handle($schedule, $released, $courier->id, 'rejected', $reason);
            } else {
                if ($task?->status !== FirstMileTaskStatus::Accepted || $schedule->starts_at->gt(now())) {
                    throw CourierPickupException::conflict('PICKUP_TRANSITION_CONFLICT', 'Only an accepted, due parcel can be reported as a failed pickup.');
                }
                $task->update(['failed_pickup_count' => $task->failed_pickup_count + 1]);
                if ($task->failed_pickup_count >= 3) {
                    $this->release->handle($schedule, collect([$task]), $courier->id, 'failed_pickup_limit', $reason);
                }
            }
            $result = [
                'schedule_id' => $schedule->id, 'task_id' => $task?->id, 'action' => $action,
                'failed_pickup_count' => $task?->failed_pickup_count,
                'available_for_scheduling' => $action === 'rejected' || $task?->released_at !== null,
                'retry_deadline_at' => $schedule->retryDeadline()->toISOString(),
            ];
            DB::table('pickup_decisions')->insert([
                'id' => (string) Str::uuid(), 'pickup_schedule_id' => $schedule->id, 'first_mile_task_id' => $task?->id,
                'courier_id' => $courier->id, 'idempotency_key' => $key, 'action' => $action,
                'request_hash' => $hash, 'reason' => $reason, 'result' => json_encode($result, JSON_THROW_ON_ERROR), 'occurred_at' => now(),
            ]);

            return $result;
        }, 3);
    }
}
