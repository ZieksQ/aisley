<?php

namespace App\Services\Courier;

use App\Enums\FulfillmentTaskStatus;
use App\Enums\ShipmentEvidenceStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\FinalMileFailedAttempt;
use App\Models\User;
use App\Services\Fulfillment\FulfillmentTransitionService;
use Illuminate\Support\Facades\DB;

class FailedDeliveryAttemptService
{
    public function __construct(private readonly FulfillmentTransitionService $fulfillment) {}

    public function record(User $courier, string $taskId, array $input, string $key): FinalMileFailedAttempt
    {
        $requestHash = hash('sha256', json_encode([$taskId, $input['reason'], trim($input['note'] ?? ''), (int) $input['expected_revision']], JSON_THROW_ON_ERROR));

        return DB::transaction(function () use ($courier, $taskId, $input, $key, $requestHash): FinalMileFailedAttempt {
            $prior = FinalMileFailedAttempt::query()->where('courier_id', $courier->id)->where('idempotency_key', $key)->lockForUpdate()->first();
            if ($prior !== null) {
                if (! hash_equals($prior->request_hash, $requestHash)) {
                    throw FulfillmentException::conflict('IDEMPOTENCY_KEY_REUSED', 'This key was used for another delivery attempt.');
                }

                return $prior;
            }
            $task = $this->fulfillment->ownedFinalTask($courier, $taskId, true);
            if ($task->revision !== (int) $input['expected_revision'] || $task->status !== FulfillmentTaskStatus::OutForDelivery) {
                throw FulfillmentException::conflict('TASK_STATE_CONFLICT', 'Refresh this delivery before reporting an attempt.');
            }
            if ($task->completionIntents()->where('status', ShipmentEvidenceStatus::AwaitingValidation->value)->exists()) {
                throw FulfillmentException::conflict('COMPLETION_PENDING', 'Logistics is already reviewing this delivery.');
            }

            return FinalMileFailedAttempt::create([
                'delivery_task_id' => $task->id,
                'courier_id' => $courier->id,
                'reason' => $input['reason'],
                'note' => trim($input['note'] ?? '') ?: null,
                'idempotency_key' => $key,
                'request_hash' => $requestHash,
                'attempted_at' => now(),
            ]);
        }, 3);
    }
}
