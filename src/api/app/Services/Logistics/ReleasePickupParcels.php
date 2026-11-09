<?php

namespace App\Services\Logistics;

use App\Enums\FirstMileTaskStatus;
use App\Enums\FulfillmentTaskStatus;
use App\Enums\PickupRouteManifestStatus;
use App\Enums\PickupScheduleStatus;
use App\Enums\ShipmentStatus;
use App\Jobs\BuildPickupRouteManifestJob;
use App\Models\FirstMileTask;
use App\Models\PickupRouteManifest;
use App\Models\PickupSchedule;
use App\Models\PickupScheduleHistory;
use App\Models\SellerPickupRequest;
use App\Models\Shipment;
use App\Models\User;
use App\Models\Waybill;
use App\Notifications\PickupScheduleNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ReleasePickupParcels
{
    /** Called inside a transaction with the organization, schedule and tasks locked. */
    public function handle(PickupSchedule $schedule, Collection $tasks, string $actorId, string $action, string $reason): void
    {
        $before = ['status' => $schedule->status->value, 'revision' => $schedule->revision];
        foreach ($tasks as $task) {
            if (! in_array($task->status, [FirstMileTaskStatus::Assigned, FirstMileTaskStatus::Accepted], true)) {
                continue;
            }
            $this->clearProjection($task, $action, $reason);
            $task->update(['status' => FirstMileTaskStatus::Cancelled, 'released_at' => now(), 'release_reason' => $action]);
        }
        $active = $schedule->tasks()->whereIn('status', [FirstMileTaskStatus::Assigned, FirstMileTaskStatus::Accepted, FirstMileTaskStatus::PickedUp])->exists();
        $schedule->update([
            'revision' => $schedule->revision + 1,
            'status' => $active ? PickupScheduleStatus::Scheduled : PickupScheduleStatus::Cancelled,
        ]);
        $schedule->reminders()->whereIn('status', ['pending', 'processing'])->update(['status' => 'suppressed']);
        PickupScheduleHistory::create([
            'pickup_schedule_id' => $schedule->id, 'actor_id' => $actorId, 'action' => $action,
            'revision' => $schedule->revision, 'before' => $before,
            'after' => ['status' => $schedule->status->value, 'revision' => $schedule->revision, 'released_task_ids' => $tasks->pluck('id')->all()],
            'reason' => $reason, 'occurred_at' => now(),
        ]);
        foreach ($schedule->orders()->pluck('seller_pickup_request_id')->unique() as $pickupId) {
            $pickup = SellerPickupRequest::query()->whereKey($pickupId)->lockForUpdate()->firstOrFail();
            $total = $pickup->orders()->count();
            $scheduled = $pickup->orders()->whereHas('order.firstMileTask')->count();
            $pickup->update(['status' => $scheduled === 0 ? 'pending_logistics' : ($scheduled === $total ? 'scheduled' : 'partially_scheduled')]);
        }
        // Retain historical membership, waybills and decisions, but rebuild the current route without released parcels.
        PickupRouteManifest::create([
            'pickup_schedule_id' => $schedule->id, 'schedule_revision' => $schedule->revision,
            'status' => $active ? PickupRouteManifestStatus::Pending : PickupRouteManifestStatus::Unavailable,
            'failure_reason' => $active ? null : 'schedule_unavailable',
        ]);
        if ($active) {
            app(PickupScheduleLifecycleService::class)->completeIfReady($schedule, $actorId);
            DB::afterCommit(fn () => BuildPickupRouteManifestJob::dispatch($schedule->id, $schedule->revision));
        }
        DB::afterCommit(function () use ($schedule): void {
            try {
                $schedule->refresh();
                $recipients = User::query()->whereIn('id', $schedule->orders()->with('order.shop')->get()->pluck('order.shop.seller_id'))
                    ->orWhere('id', $schedule->organization->user_id)->get();
                foreach ($recipients as $recipient) {
                    $recipient->notify(new PickupScheduleNotification($schedule, 'parcels_released'));
                }
            } catch (\Throwable $exception) {
                report($exception);
            }
        });
    }

    private function clearProjection(FirstMileTask $legacy, string $action, string $reason): void
    {
        Waybill::query()->whereKey($legacy->waybill_id)->lockForUpdate()->firstOrFail();
        $shipment = Shipment::query()->whereHas('parcel', fn ($q) => $q->where('waybill_id', $legacy->waybill_id))->lockForUpdate()->first();
        if ($shipment === null || ! in_array($shipment->status, [ShipmentStatus::AwaitingSellerPickup, ShipmentStatus::SellerPickupAssigned, ShipmentStatus::SellerPickupAccepted], true)) {
            return;
        }
        $physical = $shipment->tasks()->where('legacy_first_mile_task_id', $legacy->id)->lockForUpdate()->first();
        if ($physical === null) {
            return;
        }
        $before = $shipment->status->value;
        $physical->update(['status' => FulfillmentTaskStatus::AwaitingSellerPickup, 'courier_id' => null, 'legacy_first_mile_task_id' => null, 'accepted_at' => null, 'revision' => $physical->revision + 1]);
        $shipment->update(['status' => ShipmentStatus::AwaitingSellerPickup, 'revision' => $shipment->revision + 1]);
        $shipment->events()->create([
            'delivery_task_id' => $physical->id, 'event_type' => 'first_mile_assignment_released',
            'from_state' => $before, 'to_state' => $shipment->status->value, 'performing_courier_id' => $legacy->courier_id,
            'correlation_id' => (string) Str::uuid(), 'reason' => $reason,
            'metadata' => ['legacy_task_id' => $legacy->id, 'release_reason' => $action], 'occurred_at' => now(),
        ]);
    }
}
