<?php

namespace App\Services\Courier;

use App\Enums\ShipmentEvidenceStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\FinalMileFailedAttempt;
use App\Models\User;
use App\Services\Fulfillment\FulfillmentTransitionService;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

class FailedDeliveryAttemptService
{
    public function __construct(private readonly FulfillmentTransitionService $fulfillment) {}

    public function record(User $courier, string $taskId, array $input, string $key): FinalMileFailedAttempt
    {
        $requestHash = hash('sha256', json_encode([$taskId, $input['reason'], trim($input['note'] ?? ''), (int) $input['expected_revision']], JSON_THROW_ON_ERROR));

        try {
            return DB::transaction(function () use ($courier, $taskId, $input, $key, $requestHash): FinalMileFailedAttempt {
                $prior = $this->replay($courier, $key, $requestHash);
                if ($prior !== null) {
                    return $prior;
                }
                $task = $this->fulfillment->ownedFinalTask($courier, $taskId, true);
                // An absent replay row cannot be locked. A competing request may
                // have committed it while this request waited for custody locks.
                $prior = $this->replay($courier, $key, $requestHash);
                if ($prior !== null) {
                    return $prior;
                }
                if ($task->revision !== (int) $input['expected_revision'] || ! $task->status->canSubmitDelivery()) {
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
        } catch (UniqueConstraintViolationException $error) {
            if ($error->index !== 'final_mile_failed_attempts_courier_id_idempotency_key_unique') {
                throw $error;
            }

            // Different tasks have independent custody locks. Resolve their
            // Courier/key collision only after the failed transaction rolls back.
            return DB::transaction(fn (): FinalMileFailedAttempt => $this->replay($courier, $key, $requestHash) ?? throw $error, 3);
        }
    }

    private function replay(User $courier, string $key, string $requestHash): ?FinalMileFailedAttempt
    {
        $prior = FinalMileFailedAttempt::query()->where('courier_id', $courier->id)->where('idempotency_key', $key)->lockForUpdate()->first();
        if ($prior !== null && ! hash_equals($prior->request_hash, $requestHash)) {
            throw FulfillmentException::conflict('IDEMPOTENCY_KEY_REUSED', 'This key was used for another delivery attempt.');
        }

        return $prior;
    }
}
