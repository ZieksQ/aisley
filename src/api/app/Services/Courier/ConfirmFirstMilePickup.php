<?php

namespace App\Services\Courier;

use App\Enums\FirstMileTaskStatus;
use App\Enums\OrderStatus;
use App\Enums\PickupScheduleStatus;
use App\Enums\WaybillStatus;
use App\Exceptions\Courier\CourierPickupException;
use App\Models\CourierPickupConfirmation;
use App\Models\FirstMileTask;
use App\Models\PickupSchedule;
use App\Models\User;
use App\Services\Fulfillment\FulfillmentTransitionService;
use App\Services\Inventory\FulfillOrderReservation;
use App\Services\OrderTransitionService;
use App\Services\Waybills\CreateWaybill;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ConfirmFirstMilePickup
{
    public function __construct(
        private readonly CreateWaybill $waybillHasher,
        private readonly FulfillOrderReservation $inventory,
        private readonly OrderTransitionService $transitions,
        private readonly FulfillmentTransitionService $fulfillment,
    ) {}

    /** @return array{task: FirstMileTask, confirmation: CourierPickupConfirmation, idempotent: bool} */
    public function handle(User $courier, string $taskId, array $input, string $idempotencyKey): array
    {
        $requestHash = hash('sha256', json_encode([
            'task_id' => strtolower($taskId),
            'identifier_type' => $input['identifier_type'],
            'identifier' => trim($input['identifier']),
        ], JSON_THROW_ON_ERROR));

        return DB::transaction(function () use ($courier, $taskId, $input, $idempotencyKey, $requestHash): array {
            $previous = CourierPickupConfirmation::query()
                ->where('courier_id', $courier->id)
                ->where('idempotency_key', $idempotencyKey)
                ->lockForUpdate()
                ->first();
            if ($previous !== null) {
                $this->assertReplay($previous, $taskId, $requestHash);

                return [
                    'task' => $this->loadOwnedTask($courier, $previous->first_mile_task_id, false),
                    'confirmation' => $previous,
                    'idempotent' => true,
                ];
            }

            $task = $this->loadOwnedTask($courier, $taskId);
            $previous = CourierPickupConfirmation::query()
                ->where('courier_id', $courier->id)
                ->where('idempotency_key', $idempotencyKey)
                ->lockForUpdate()
                ->first();
            if ($previous !== null) {
                $this->assertReplay($previous, $taskId, $requestHash);

                return ['task' => $task, 'confirmation' => $previous, 'idempotent' => true];
            }

            if (
                $task->status !== FirstMileTaskStatus::Accepted
                || $task->schedule->status !== PickupScheduleStatus::Scheduled
                || $task->waybill->status !== WaybillStatus::Active
            ) {
                throw CourierPickupException::conflict('PICKUP_TRANSITION_CONFLICT', 'This task can no longer be confirmed as picked up.');
            }

            if (! $this->identifierMatches($task, $input['identifier_type'], trim($input['identifier']))) {
                throw CourierPickupException::notFound();
            }

            $order = $task->order()->lockForUpdate()->first();
            if ($order === null || $order->status !== OrderStatus::ReadyForPickup) {
                throw CourierPickupException::conflict('ORDER_PICKUP_STATUS_CONFLICT', 'This Order can no longer be confirmed as picked up.');
            }
            $task->setRelation('order', $order);

            $pickedUpAt = now();
            $correlationId = (string) Str::uuid();
            $this->inventory->handle($task->order, $courier, $task->id);
            $this->transitions->transition($task->order, OrderStatus::ReadyForPickup, OrderStatus::PickedUp, 'courier_first_mile_pickup');
            $task->update([
                'status' => FirstMileTaskStatus::PickedUp,
                'picked_up_at' => $pickedUpAt,
            ]);
            $confirmation = CourierPickupConfirmation::create([
                'first_mile_task_id' => $task->id,
                'order_id' => $task->order_id,
                'waybill_id' => $task->waybill_id,
                'courier_id' => $courier->id,
                'idempotency_key' => $idempotencyKey,
                'request_hash' => $requestHash,
                'previous_status' => FirstMileTaskStatus::Accepted,
                'new_status' => FirstMileTaskStatus::PickedUp,
                'schedule_revision' => $task->schedule->revision,
                'correlation_id' => $correlationId,
                'picked_up_at' => $pickedUpAt,
            ]);
            // Bridge the legacy first-mile confirmation into the shared physical
            // shipment projection without replaying the inventory effect.
            $this->fulfillment->syncLegacyFirstMile($task);

            return ['task' => $task->fresh($this->relations()), 'confirmation' => $confirmation, 'idempotent' => false];
        }, 3);
    }

    private function loadOwnedTask(User $courier, string $taskId, bool $lock = true): FirstMileTask
    {
        $affiliation = $courier->courierLogisticsAffiliation()->first();
        if ($affiliation === null) {
            throw CourierPickupException::notFound();
        }

        $scope = fn ($query) => $query
            ->where('courier_id', $courier->id)
            ->where('logistics_organization_id', $affiliation->logistics_organization_id)
            ->where('logistics_hub_id', $affiliation->logistics_hub_id)
            ->whereKey($taskId);

        if (! $lock) {
            return FirstMileTask::query()->where($scope)->with($this->relations())->first()
                ?? throw CourierPickupException::notFound();
        }

        $schedule = PickupSchedule::query()->whereHas('tasks', $scope)->lockForUpdate()->first();
        if ($schedule === null) {
            throw CourierPickupException::notFound();
        }

        return FirstMileTask::query()->where($scope)->where('pickup_schedule_id', $schedule->id)
            ->with($this->relations())->lockForUpdate()->first()
            ?? throw CourierPickupException::notFound();
    }

    private function identifierMatches(FirstMileTask $task, string $type, string $identifier): bool
    {
        if ($type === 'qr') {
            return hash_equals($task->waybill->qr_token_hash, $this->waybillHasher->hashQr($identifier));
        }

        return hash_equals(strtoupper((string) $task->order->reference), strtoupper($identifier));
    }

    private function assertReplay(CourierPickupConfirmation $confirmation, string $taskId, string $requestHash): void
    {
        if ($confirmation->first_mile_task_id !== $taskId || ! hash_equals($confirmation->request_hash, $requestHash)) {
            throw CourierPickupException::conflict('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for another pickup confirmation.');
        }
    }

    /** @return list<string> */
    private function relations(): array
    {
        return [
            'schedule',
            'waybill.snapshot',
            'order:id,reference,shop_id,status',
            'order.address',
            'order.shop:id,seller_id,name,contact_number',
        ];
    }
}
