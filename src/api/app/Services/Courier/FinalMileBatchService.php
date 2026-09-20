<?php

namespace App\Services\Courier;

use App\Enums\FulfillmentTaskLeg;
use App\Enums\FulfillmentTaskStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\DispatchSchedule;
use App\Models\User;
use App\Services\Fulfillment\FulfillmentTransitionService;
use Illuminate\Support\Facades\DB;

class FinalMileBatchService
{
    public function __construct(private readonly FulfillmentTransitionService $fulfillment) {}

    public function schedule(User $courier, string $id): DispatchSchedule
    {
        $affiliation = $courier->courierLogisticsAffiliation()->firstOrFail();

        $schedule = DispatchSchedule::query()->whereKey($id)->where('courier_id', $courier->id)
            ->where('logistics_organization_id', $affiliation->logistics_organization_id)
            ->where('logistics_hub_id', $affiliation->logistics_hub_id)
            ->with(['shipments.task', 'shipments.shipment.parcel.order'])
            ->firstOrFail();

        if (! $this->isCurrent($courier, $schedule)) {
            throw FulfillmentException::notFound('BATCH_NOT_FOUND', 'This final-mile dispatch is not available.');
        }

        return $schedule;
    }

    public function isCurrent(User $courier, DispatchSchedule $schedule): bool
    {
        return $schedule->shipments->isNotEmpty() && $schedule->shipments->every(fn ($member) => $member->task?->courier_id === $courier->id
            && $member->task?->leg === FulfillmentTaskLeg::FinalMile
            && $member->shipment?->current_logistics_organization_id === $schedule->logistics_organization_id
            && $member->shipment?->current_hub_id === $schedule->logistics_hub_id);
    }

    public function accept(User $courier, string $id): DispatchSchedule
    {
        return DB::transaction(function () use ($courier, $id): DispatchSchedule {
            $schedule = $this->schedule($courier, $id);
            DispatchSchedule::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            $members = $schedule->shipments->sortBy('delivery_task_id')->values();
            if ($members->isEmpty()) {
                throw FulfillmentException::conflict('BATCH_EMPTY', 'This dispatch has no parcels.');
            }
            foreach ($members as $member) {
                try {
                    $task = $this->fulfillment->ownedFinalTask($courier, $member->delivery_task_id, true);
                } catch (FulfillmentException $exception) {
                    if ($exception->status !== 404) {
                        throw $exception;
                    }
                    throw FulfillmentException::conflict('BATCH_STATE_CONFLICT', 'A parcel is no longer assigned to you. Refresh the dispatch.');
                }
                if ($task->status !== FulfillmentTaskStatus::DeliveryAssigned && $task->accepted_at === null) {
                    throw FulfillmentException::conflict('BATCH_STATE_CONFLICT', 'A parcel is no longer available for batch acceptance. Refresh the dispatch.');
                }
            }
            foreach ($members as $member) {
                if ($member->task->status === FulfillmentTaskStatus::DeliveryAssigned) {
                    $this->fulfillment->acceptFinal($courier, $member->delivery_task_id);
                }
            }

            return $this->schedule($courier, $id);
        }, 3);
    }

    public function projection(User $courier, DispatchSchedule $schedule): array
    {
        return [
            'id' => $schedule->id,
            'reference' => $schedule->reference,
            'scheduled_for' => $schedule->scheduled_for->toISOString(),
            'parcel_count' => $schedule->shipments->count(),
            'status' => $schedule->shipments->every(fn ($member) => $member->task?->status === FulfillmentTaskStatus::DeliveryAccepted)
                ? 'accepted'
                : ($schedule->shipments->every(fn ($member) => $member->task?->accepted_at !== null) ? 'in_progress' : 'offered'),
            'tasks' => $schedule->shipments->sortBy('sequence')->map(fn ($member) => $this->fulfillment->taskProjection($member->task))->values()->all(),
        ];
    }
}
