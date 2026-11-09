<?php

namespace App\Services\Logistics;

use App\Enums\FirstMileTaskStatus;
use App\Enums\PickupScheduleStatus;
use App\Models\FirstMileTask;
use App\Models\PickupSchedule;
use App\Models\PickupScheduleHistory;
use App\Models\PickupScheduleOrder;
use Illuminate\Support\Facades\DB;

class PickupScheduleLifecycleService
{
    /**
     * Complete a schedule after every linked parcel has been received at the hub.
     *
     * The schedule row, membership rows, and task rows are locked in that order
     * so this can safely be called from the Logistics hub-receipt transaction or
     * independently by the reconciliation command.
     */
    public function completeIfReady(PickupSchedule $schedule, string $actorId): bool
    {
        return DB::transaction(function () use ($schedule, $actorId): bool {
            $locked = $this->lockSchedule($schedule->id);

            return $this->completeLocked($locked, $actorId, 'All linked parcels were received at the Logistics hub.');
        }, 3);
    }

    /**
     * Reconcile one legacy schedule without replaying pickup, inventory, or
     * notification effects.
     *
     * @return array{status: 'completed'|'skipped'|'inconsistent', reason: string}
     */
    public function reconcile(string $scheduleId): array
    {
        return DB::transaction(function () use ($scheduleId): array {
            $schedule = $this->lockSchedule($scheduleId);
            if ($schedule->status !== PickupScheduleStatus::Scheduled) {
                return ['status' => 'skipped', 'reason' => 'schedule_not_scheduled'];
            }

            $assessment = $this->assessment($schedule);
            if ($assessment['ready'] !== true) {
                return ['status' => 'inconsistent', 'reason' => $assessment['reason']];
            }

            $this->completeLocked($schedule, $schedule->courier_id, 'Reconciled from existing pickup and hub receipt evidence.');

            return ['status' => 'completed', 'reason' => 'all_parcels_received_at_hub'];
        }, 3);
    }

    private function completeLocked(PickupSchedule $schedule, string $actorId, string $reason): bool
    {
        if ($schedule->status !== PickupScheduleStatus::Scheduled) {
            return false;
        }

        $assessment = $this->assessment($schedule);
        if ($assessment['ready'] !== true) {
            return false;
        }

        $before = $this->state($schedule);
        $schedule->update(['status' => PickupScheduleStatus::Completed]);
        $schedule->reminders()
            ->whereIn('status', ['pending', 'processing'])
            ->update(['status' => 'suppressed']);
        PickupScheduleHistory::create([
            'pickup_schedule_id' => $schedule->id,
            'actor_id' => $actorId,
            'action' => 'completed',
            'revision' => $schedule->revision,
            'before' => $before,
            'after' => $this->state($schedule),
            'reason' => $reason,
            'occurred_at' => now(),
        ]);

        return true;
    }

    /**
     * @return array{ready: bool, reason: string}
     */
    private function assessment(PickupSchedule $schedule): array
    {
        $orderLinks = PickupScheduleOrder::query()
            ->where('pickup_schedule_id', $schedule->id)
            ->lockForUpdate()
            ->get(['id', 'order_id']);
        $tasks = FirstMileTask::query()
            ->where('pickup_schedule_id', $schedule->id)
            ->lockForUpdate()
            ->get(['id', 'order_id', 'status', 'released_at']);

        if ($orderLinks->isEmpty() || $tasks->isEmpty()) {
            return ['ready' => false, 'reason' => 'empty_schedule'];
        }
        if ($tasks->pluck('order_id')->sort()->values()->all() !== $orderLinks->pluck('order_id')->sort()->values()->all()) {
            return ['ready' => false, 'reason' => 'task_membership_mismatch'];
        }
        $tasks = $tasks->reject(fn (FirstMileTask $task): bool => $task->status === FirstMileTaskStatus::Cancelled && $task->released_at !== null);
        if ($tasks->isEmpty()) {
            return ['ready' => false, 'reason' => 'no_retained_parcels'];
        }
        if ($tasks->contains(fn (FirstMileTask $task): bool => $task->status === FirstMileTaskStatus::Cancelled)) {
            return ['ready' => false, 'reason' => 'cancelled_task_present'];
        }
        if ($tasks->contains(fn (FirstMileTask $task): bool => $task->status !== FirstMileTaskStatus::PickedUp)) {
            return ['ready' => false, 'reason' => 'tasks_not_all_picked_up'];
        }

        $receivedCount = $schedule->tasks()->where('status', FirstMileTaskStatus::PickedUp)->whereHas('order.parcel.shipment', fn ($query) => $query->whereNotNull('received_at_hub_at'))->count();
        if ($receivedCount !== $tasks->count()) {
            return ['ready' => false, 'reason' => 'parcels_not_all_received_at_hub'];
        }

        return ['ready' => true, 'reason' => 'all_parcels_received_at_hub'];
    }

    private function lockSchedule(string $scheduleId): PickupSchedule
    {
        return PickupSchedule::query()->whereKey($scheduleId)->lockForUpdate()->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function state(PickupSchedule $schedule): array
    {
        return [
            'status' => $schedule->status instanceof PickupScheduleStatus ? $schedule->status->value : $schedule->status,
            'courier_id' => $schedule->courier_id,
            'starts_at' => $schedule->starts_at->toISOString(),
            'ends_at' => $schedule->ends_at?->toISOString(),
            'revision' => $schedule->revision,
        ];
    }
}
