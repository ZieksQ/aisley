<?php

namespace App\Services\Fulfillment;

use App\Enums\CourierAffiliationStatus;
use App\Enums\FirstMileTaskStatus;
use App\Enums\FulfillmentOfferStatus;
use App\Enums\FulfillmentTaskLeg;
use App\Enums\FulfillmentTaskStatus;
use App\Enums\OrderStatus;
use App\Enums\ShipmentEvidencePurpose;
use App\Enums\ShipmentEvidenceStatus;
use App\Enums\ShipmentStatus;
use App\Enums\UserStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\CompletionIntent;
use App\Models\CourierLogisticsAffiliation;
use App\Models\DeliveryTask;
use App\Models\DeliveryTaskOffer;
use App\Models\FirstMileTask;
use App\Models\LogisticsOrganization;
use App\Models\Parcel;
use App\Models\Shipment;
use App\Models\ShipmentEvent;
use App\Models\ShipmentEvidence;
use App\Models\User;
use App\Models\Waybill;
use App\Notifications\Seller\SellerOrderDeliveredNotification;
use App\Services\OrderTransitionService;
use App\Services\Waybills\CreateWaybill;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class FulfillmentTransitionService
{
    public function __construct(
        private readonly OrderTransitionService $orderTransitions,
        private readonly CreateWaybill $waybillHasher,
    ) {}

    /**
     * Build the shared physical records for a waybill without changing Order or Inventory.
     * This is also the compatibility bridge for an already completed legacy first-mile task.
     */
    public function ensureForWaybill(Waybill $waybill): Shipment
    {
        return DB::transaction(fn (): Shipment => $this->ensureForWaybillInTransaction($waybill));
    }

    public function syncLegacyFirstMile(FirstMileTask $legacy): Shipment
    {
        return DB::transaction(function () use ($legacy): Shipment {
            $legacy = FirstMileTask::query()->whereKey($legacy->id)->with(['waybill.snapshot', 'order.items', 'order.address'])->lockForUpdate()->firstOrFail();
            $shipment = $this->ensureForWaybillInTransaction($legacy->waybill);
            $physical = DeliveryTask::query()->where('shipment_id', $shipment->id)->where('leg', FulfillmentTaskLeg::FirstMile->value)->lockForUpdate()->firstOrFail();

            if ($legacy->status === FirstMileTaskStatus::PickedUp && $physical->status !== FulfillmentTaskStatus::PickedUpFromSeller) {
                $before = $shipment->status->value;
                $physical->update(['status' => FulfillmentTaskStatus::PickedUpFromSeller, 'courier_id' => $legacy->courier_id, 'picked_up_at' => $legacy->picked_up_at ?? now(), 'revision' => $physical->revision + 1]);
                $shipment->update(['status' => ShipmentStatus::PickedUpFromSeller, 'revision' => $shipment->revision + 1]);
                $this->event($shipment, $physical, 'legacy_first_mile_pickup', $before, ShipmentStatus::PickedUpFromSeller->value, $legacy->courier_id, null, null, null, ['legacy_task_id' => $legacy->id]);
            }

            return $shipment->fresh($this->shipmentRelations());
        }, 3);
    }

    /** @return array{shipment: Shipment, task: DeliveryTask, offer: DeliveryTaskOffer|null} */
    public function offerFinal(User $logistics, string $taskId, string $courierId, int $expectedRevision, string $idempotencyKey): array
    {
        $requestHash = $this->hash(['task_id' => strtolower($taskId), 'courier_id' => strtolower($courierId), 'expected_revision' => $expectedRevision]);

        return DB::transaction(function () use ($logistics, $taskId, $courierId, $expectedRevision, $idempotencyKey, $requestHash): array {
            $previous = DeliveryTaskOffer::query()->where('offered_by_logistics_id', $logistics->id)->where('idempotency_key', $idempotencyKey)->lockForUpdate()->first();
            if ($previous !== null) {
                if (! hash_equals($previous->request_hash, $requestHash)) {
                    throw FulfillmentException::conflict('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for another offer.');
                }

                return $this->offerResult($previous->fresh(['task.shipment.parcel.order', 'task.shipment.parcel.waybill', 'task.shipment.tasks']));
            }

            $org = $this->logisticsOrganization($logistics);
            $task = DeliveryTask::query()->whereKey($taskId)->where('leg', FulfillmentTaskLeg::FinalMile->value)
                ->whereHas('shipment', fn ($query) => $query->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id))
                ->with($this->taskRelations())->lockForUpdate()->first();
            if ($task === null) {
                throw FulfillmentException::notFound('TASK_NOT_FOUND', 'This final-mile task is not available.');
            }
            $shipment = $task->shipment;
            if ($task->revision !== $expectedRevision) {
                throw FulfillmentException::conflict('TASK_STATE_CONFLICT', 'The final-mile task changed. Refresh before offering it again.');
            }
            if (! in_array($task->status, [FulfillmentTaskStatus::DeliveryAssigned, FulfillmentTaskStatus::Rejected], true)) {
                throw FulfillmentException::conflict('TASK_STATE_CONFLICT', 'Only an unaccepted final-mile task can be offered.');
            }
            $active = $task->offers()->where('status', FulfillmentOfferStatus::Offered->value)->lockForUpdate()->first();
            if ($active !== null) {
                throw FulfillmentException::conflict('TASK_ALREADY_OFFERED', 'This task already has an active Courier offer.');
            }
            $this->assertCourier($courierId, $org->id, $org->hub->id);
            $before = $task->status->value;
            $sequence = ((int) $task->offers()->max('sequence')) + 1;
            $offer = $task->offers()->create([
                'courier_id' => $courierId,
                'logistics_organization_id' => $org->id,
                'offered_by_logistics_id' => $logistics->id,
                'sequence' => $sequence,
                'status' => FulfillmentOfferStatus::Offered,
                'idempotency_key' => $idempotencyKey,
                'request_hash' => $requestHash,
                'offered_at' => now(),
            ]);
            $task->update(['status' => FulfillmentTaskStatus::DeliveryAssigned, 'courier_id' => $courierId, 'revision' => $task->revision + 1]);
            if ($shipment->status === ShipmentStatus::DispatchedFromHub) {
                $shipment->update(['status' => ShipmentStatus::DeliveryAssigned, 'revision' => $shipment->revision + 1]);
            }
            $this->event($shipment, $task, 'final_mile_offer', $before, FulfillmentTaskStatus::DeliveryAssigned->value, null, $logistics->id, $offer, null, ['courier_id' => $courierId, 'sequence' => $sequence], $idempotencyKey);

            return $this->offerResult($offer->fresh(['task.shipment.parcel.order', 'task.shipment.parcel.waybill', 'task.shipment.tasks']));
        }, 3);
    }

    /** @return Collection<int, array<string, mixed>> */
    public function candidates(User $logistics, DeliveryTask $task): Collection
    {
        $org = $this->logisticsOrganization($logistics);
        $current = DeliveryTask::query()->whereKey($task->id)->where('leg', FulfillmentTaskLeg::FinalMile->value)
            ->whereHas('shipment', fn ($query) => $query->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id))->first();
        if ($current === null) {
            throw FulfillmentException::notFound('TASK_NOT_FOUND', 'This final-mile task is not available.');
        }
        if (! in_array($current->status, [FulfillmentTaskStatus::DeliveryAssigned, FulfillmentTaskStatus::Rejected], true)) {
            throw FulfillmentException::conflict('TASK_STATE_CONFLICT', 'Candidates are only available before a final-mile offer is accepted.');
        }

        return CourierLogisticsAffiliation::query()->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id)
            ->where('status', CourierAffiliationStatus::Approved)->whereHas('courier', fn ($query) => $query->where('status', UserStatus::Active))
            ->with('courier.courierProfile')->orderBy('created_at')->get()->map(fn (CourierLogisticsAffiliation $affiliation): array => [
                'courier_id' => $affiliation->courier_id,
                'name' => trim(($affiliation->courier->courierProfile?->first_name ?? '').' '.($affiliation->courier->courierProfile?->last_name ?? '')),
                'email' => $affiliation->courier->email,
                'distance_km' => null,
                'estimated_duration_minutes' => null,
                'route_status' => 'unavailable',
            ]);
    }

    public function acceptFinal(User $courier, string $taskId): DeliveryTask
    {
        return DB::transaction(function () use ($courier, $taskId): DeliveryTask {
            $task = $this->ownedFinalTask($courier, $taskId, true);
            $offer = $task->offers()->where('courier_id', $courier->id)->orderByDesc('sequence')->lockForUpdate()->first();
            if ($offer === null) {
                throw FulfillmentException::notFound('TASK_NOT_FOUND', 'This final-mile offer is not available.');
            }
            if ($offer->status === FulfillmentOfferStatus::Accepted && $task->status === FulfillmentTaskStatus::DeliveryAccepted) {
                return $task->fresh($this->taskRelations());
            }
            if ($offer->status !== FulfillmentOfferStatus::Offered || $task->status !== FulfillmentTaskStatus::DeliveryAssigned) {
                throw FulfillmentException::conflict('TASK_STATE_CONFLICT', 'This final-mile offer can no longer be accepted.');
            }
            $before = $task->status->value;
            $offer->update(['status' => FulfillmentOfferStatus::Accepted, 'responded_at' => now()]);
            $task->update(['status' => FulfillmentTaskStatus::DeliveryAccepted, 'accepted_at' => now(), 'revision' => $task->revision + 1]);
            $shipment = Shipment::query()->whereKey($task->shipment_id)->lockForUpdate()->firstOrFail();
            if ($shipment->status !== ShipmentStatus::DeliveryAssigned && $shipment->status !== ShipmentStatus::DispatchedFromHub) {
                throw FulfillmentException::conflict('SHIPMENT_STATE_CONFLICT', 'The shipment is not ready for final-mile acceptance.');
            }
            $shipment->update(['status' => ShipmentStatus::DeliveryAccepted, 'revision' => $shipment->revision + 1]);
            $this->event($shipment, $task, 'final_mile_acceptance', $before, FulfillmentTaskStatus::DeliveryAccepted->value, $courier->id, null, $offer);

            return $task->fresh($this->taskRelations());
        }, 3);
    }

    public function rejectFinal(User $courier, string $taskId, string $reason, string $idempotencyKey): DeliveryTask
    {
        $requestHash = $this->hash(['task_id' => strtolower($taskId), 'reason' => trim($reason)]);

        return DB::transaction(function () use ($courier, $taskId, $reason, $idempotencyKey, $requestHash): DeliveryTask {
            $previous = DeliveryTaskOffer::query()->where('courier_id', $courier->id)->where('idempotency_key', $idempotencyKey)->lockForUpdate()->first();
            if ($previous !== null) {
                if (! hash_equals($previous->request_hash, $requestHash)) {
                    throw FulfillmentException::conflict('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for another rejection.');
                }

                return $previous->task->fresh($this->taskRelations());
            }
            $task = $this->ownedFinalTask($courier, $taskId, true);
            $offer = $task->offers()->where('courier_id', $courier->id)->orderByDesc('sequence')->lockForUpdate()->first();
            if ($offer === null || $offer->status !== FulfillmentOfferStatus::Offered || $task->status !== FulfillmentTaskStatus::DeliveryAssigned) {
                throw FulfillmentException::conflict('TASK_STATE_CONFLICT', 'This final-mile offer can no longer be rejected.');
            }
            $before = $task->status->value;
            $offer->update(['status' => FulfillmentOfferStatus::Rejected, 'rejection_reason' => trim($reason), 'responded_at' => now()]);
            $task->update(['status' => FulfillmentTaskStatus::Rejected, 'courier_id' => null, 'revision' => $task->revision + 1]);
            $this->event($task->shipment, $task, 'final_mile_rejection', $before, FulfillmentTaskStatus::Rejected->value, $courier->id, null, $offer, null, ['reason' => trim($reason)], $idempotencyKey);

            return $task->fresh($this->taskRelations());
        }, 3);
    }

    public function submitEvidence(User $courier, string $taskId, array $input, string $idempotencyKey, ShipmentEvidencePurpose $purpose): ShipmentEvidence
    {
        $requestHash = $this->hash(['task_id' => strtolower($taskId), 'purpose' => $purpose->value, 'identifier_type' => $input['identifier_type'], 'identifier' => trim($input['identifier']), 'expected_revision' => (int) $input['expected_revision']]);

        return DB::transaction(function () use ($courier, $taskId, $input, $idempotencyKey, $requestHash, $purpose): ShipmentEvidence {
            $previous = ShipmentEvidence::query()->where('courier_id', $courier->id)->where('idempotency_key', $idempotencyKey)->lockForUpdate()->first();
            if ($previous !== null) {
                if (! hash_equals($previous->request_hash, $requestHash)) {
                    throw FulfillmentException::conflict('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for another evidence submission.');
                }

                return $previous->fresh($this->evidenceRelations());
            }
            $task = $this->ownedFinalTask($courier, $taskId, true);
            if (isset($input['expected_revision']) && (int) $input['expected_revision'] !== $task->revision) {
                throw FulfillmentException::conflict('TASK_STATE_CONFLICT', 'The final-mile task changed. Refresh before submitting evidence.');
            }
            $requiredState = $purpose === ShipmentEvidencePurpose::HubPickup ? FulfillmentTaskStatus::DeliveryAccepted : FulfillmentTaskStatus::OutForDelivery;
            if ($task->status !== $requiredState) {
                throw FulfillmentException::conflict('TASK_STATE_CONFLICT', 'Evidence cannot be submitted for the task in its current state.');
            }
            $identifier = trim((string) $input['identifier']);
            if (! $this->identifierMatches($task->shipment->parcel->waybill, $task->shipment->parcel->order, $input['identifier_type'], $identifier)) {
                throw FulfillmentException::notFound('PARCEL_NOT_FOUND', 'The scanned parcel identifier is not assigned to this task.');
            }
            $offer = $task->offers()->where('status', FulfillmentOfferStatus::Accepted->value)->where('courier_id', $courier->id)->orderByDesc('sequence')->first();
            $evidence = ShipmentEvidence::create([
                'delivery_task_id' => $task->id,
                'delivery_task_offer_id' => $offer?->id,
                'waybill_id' => $task->shipment->parcel->waybill_id,
                'courier_id' => $courier->id,
                'purpose' => $purpose,
                'type' => 'qr',
                'safe_reference' => $task->shipment->parcel->waybill->reference,
                'identifier_hash' => hash('sha256', $identifier),
                'status' => ShipmentEvidenceStatus::AwaitingValidation,
                'idempotency_key' => $idempotencyKey,
                'request_hash' => $requestHash,
                'correlation_id' => (string) Str::uuid(),
                'metadata' => ['identifier_type' => $input['identifier_type']],
                'submitted_at' => now(),
            ]);

            return $evidence->fresh($this->evidenceRelations());
        }, 3);
    }

    public function transitionCourierStatus(User $courier, string $taskId, string $target, int $expectedRevision, string $idempotencyKey): DeliveryTask
    {
        $requestHash = $this->hash(['task_id' => strtolower($taskId), 'target_state' => $target, 'expected_revision' => $expectedRevision]);

        return DB::transaction(function () use ($courier, $taskId, $target, $expectedRevision, $idempotencyKey, $requestHash): DeliveryTask {
            $prior = ShipmentEvent::query()->where('performing_courier_id', $courier->id)->where('idempotency_key', $idempotencyKey)->lockForUpdate()->first();
            if ($prior !== null) {
                if (($prior->metadata['request_hash'] ?? null) !== $requestHash) {
                    throw FulfillmentException::conflict('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for another transition.');
                }

                return DeliveryTask::query()->whereKey($prior->delivery_task_id)->with($this->taskRelations())->firstOrFail();
            }
            $task = $this->ownedFinalTask($courier, $taskId, true);
            if ($task->revision !== $expectedRevision) {
                throw FulfillmentException::conflict('TASK_STATE_CONFLICT', 'The final-mile task changed. Refresh before updating its status.');
            }
            $from = $task->status;
            $expectedFrom = $target === FulfillmentTaskStatus::InTransit->value ? FulfillmentTaskStatus::PickedUpFromHub : FulfillmentTaskStatus::InTransit;
            if ($from !== $expectedFrom) {
                throw FulfillmentException::conflict('TASK_STATE_CONFLICT', 'This status transition is not allowed from the current task state.');
            }
            $shipment = Shipment::query()->whereKey($task->shipment_id)->lockForUpdate()->firstOrFail();
            if ($shipment->status->value !== $from->value) {
                throw FulfillmentException::conflict('SHIPMENT_STATE_CONFLICT', 'The shipment and task states are inconsistent.');
            }
            $order = $shipment->parcel->order()->lockForUpdate()->firstOrFail();
            $orderFrom = $target === FulfillmentTaskStatus::InTransit->value ? OrderStatus::PickedUp : OrderStatus::InTransit;
            $orderTo = $target === FulfillmentTaskStatus::InTransit->value ? OrderStatus::InTransit : OrderStatus::OutForDelivery;
            if ($order->status !== $orderFrom) {
                throw FulfillmentException::conflict('ORDER_STATE_CONFLICT', 'The Order is not ready for this delivery transition.');
            }
            $this->orderTransitions->transition($order, $orderFrom, $orderTo, 'courier_final_mile');
            $at = now();
            $task->update([
                'status' => $target,
                $target === FulfillmentTaskStatus::InTransit->value ? 'in_transit_at' : 'out_for_delivery_at' => $at,
                'revision' => $task->revision + 1,
            ]);
            $shipment->update(['status' => $target, 'revision' => $shipment->revision + 1]);
            $this->event($shipment, $task, 'courier_status', $from->value, $target, $courier->id, null, null, null, ['request_hash' => $requestHash], $idempotencyKey);

            return $task->fresh($this->taskRelations());
        }, 3);
    }

    public function submitCompletion(User $courier, string $taskId, string $evidenceId, int $expectedRevision, string $idempotencyKey): CompletionIntent
    {
        $requestHash = $this->hash(['task_id' => strtolower($taskId), 'evidence_id' => strtolower($evidenceId), 'expected_revision' => $expectedRevision, 'confirmed' => true]);

        return DB::transaction(function () use ($courier, $taskId, $evidenceId, $expectedRevision, $idempotencyKey, $requestHash): CompletionIntent {
            $previous = CompletionIntent::query()->where('courier_id', $courier->id)->where('idempotency_key', $idempotencyKey)->lockForUpdate()->first();
            if ($previous !== null) {
                if (! hash_equals($previous->request_hash, $requestHash)) {
                    throw FulfillmentException::conflict('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for another completion intent.');
                }

                return $previous->fresh($this->completionRelations());
            }
            $task = $this->ownedFinalTask($courier, $taskId, true);
            if ($task->revision !== $expectedRevision || $task->status !== FulfillmentTaskStatus::OutForDelivery) {
                throw FulfillmentException::conflict('COMPLETION_STATE_CONFLICT', 'The task is not ready for completion. Refresh and try again.');
            }
            $evidence = ShipmentEvidence::query()->whereKey($evidenceId)->where('delivery_task_id', $task->id)->where('courier_id', $courier->id)->where('purpose', ShipmentEvidencePurpose::DeliveryProof->value)->lockForUpdate()->first();
            if ($evidence === null) {
                throw FulfillmentException::notFound('PROOF_NOT_FOUND', 'The delivery proof is not available for this task.');
            }
            if ($evidence->status === ShipmentEvidenceStatus::Rejected || $evidence->status === ShipmentEvidenceStatus::Unavailable) {
                throw FulfillmentException::conflict('PROOF_NOT_VALIDATED', 'The delivery proof cannot be used for completion.');
            }

            return CompletionIntent::create([
                'delivery_task_id' => $task->id,
                'shipment_evidence_id' => $evidence->id,
                'courier_id' => $courier->id,
                'expected_revision' => $expectedRevision,
                'status' => ShipmentEvidenceStatus::AwaitingValidation,
                'idempotency_key' => $idempotencyKey,
                'request_hash' => $requestHash,
                'confirmed_at' => now(),
            ])->fresh($this->completionRelations());
        }, 3);
    }

    /**
     * Record a Logistics-authoritative physical transition. Hub states, final-mile hub pickup,
     * movement recovery, and delivery completion all use this single state machine.
     *
     * @return array{shipment: Shipment, task: DeliveryTask|null, event: ShipmentEvent}
     */
    public function transitionLogistics(User $logistics, array $input, string $idempotencyKey): array
    {
        $requestHash = $this->hash($input);

        return DB::transaction(function () use ($logistics, $input, $idempotencyKey, $requestHash): array {
            $prior = ShipmentEvent::query()->where('recorded_by_logistics_id', $logistics->id)->where('idempotency_key', $idempotencyKey)->lockForUpdate()->first();
            if ($prior !== null) {
                if (($prior->metadata['request_hash'] ?? null) !== $requestHash) {
                    throw FulfillmentException::conflict('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for another transition.');
                }
                $shipment = Shipment::query()->whereKey($prior->shipment_id)->with($this->shipmentRelations())->firstOrFail();

                return ['shipment' => $shipment, 'task' => $prior->delivery_task_id ? $shipment->tasks->firstWhere('id', $prior->delivery_task_id) : null, 'event' => $prior];
            }
            $org = $this->logisticsOrganization($logistics);
            $waybill = $this->resolveWaybill($org, (string) $input['reference']);
            $shipment = $this->ensureForWaybillInTransaction($waybill);
            $shipment = Shipment::query()->whereKey($shipment->id)->with($this->shipmentRelations())->lockForUpdate()->firstOrFail();
            if ($shipment->revision !== (int) $input['expected_revision']) {
                throw FulfillmentException::conflict('SHIPMENT_STATE_CONFLICT', 'The shipment changed. Refresh its current revision before trying again.');
            }
            $target = (string) $input['target_state'];
            $from = $shipment->status;
            if (! $this->allowedShipmentTransition($from, $target)) {
                throw FulfillmentException::conflict('SHIPMENT_STATE_CONFLICT', 'That fulfillment transition is not allowed from the current state.');
            }
            $task = $this->taskForTransition($shipment, $target);
            $evidence = null;
            if ($target === ShipmentStatus::PickedUpFromHub->value || $target === ShipmentStatus::Delivered->value) {
                if (empty($input['evidence_id'])) {
                    throw FulfillmentException::invalid('PROOF_REQUIRED', 'Validated evidence is required for this transition.', 'evidence_id');
                }
                $evidence = ShipmentEvidence::query()->whereKey($input['evidence_id'])->where('delivery_task_id', $task?->id)->lockForUpdate()->first();
                if ($evidence === null || $evidence->courier_id !== $task?->courier_id) {
                    throw FulfillmentException::notFound('PROOF_NOT_FOUND', 'The supplied evidence is not linked to this task.');
                }
            }

            if ($target === ShipmentStatus::PickedUpFromHub->value) {
                if ($task === null || $task->leg !== FulfillmentTaskLeg::FinalMile || $task->status !== FulfillmentTaskStatus::DeliveryAccepted || $evidence?->purpose !== ShipmentEvidencePurpose::HubPickup) {
                    throw FulfillmentException::conflict('PICKUP_STATE_CONFLICT', 'The final-mile task or hub-pickup evidence is not ready.');
                }
                $this->validateEvidence($evidence, $logistics);
                $at = now();
                $task->update(['status' => FulfillmentTaskStatus::PickedUpFromHub, 'picked_up_at' => $at, 'revision' => $task->revision + 1]);
                $shipment->update(['status' => ShipmentStatus::PickedUpFromHub, 'revision' => $shipment->revision + 1]);
                $event = $this->event($shipment, $task, 'hub_pickup_validated', $from->value, $target, $task->courier_id, $logistics->id, $task->offers()->where('status', FulfillmentOfferStatus::Accepted->value)->latest('sequence')->first(), $evidence, ['request_hash' => $requestHash], $idempotencyKey);

                return ['shipment' => $shipment->fresh($this->shipmentRelations()), 'task' => $task->fresh($this->taskRelations()), 'event' => $event];
            }

            if ($target === ShipmentStatus::Delivered->value) {
                return $this->finalizeDelivery($logistics, $shipment, $task, $evidence, $requestHash, $idempotencyKey, $input['reason'] ?? null);
            }

            if (in_array($target, [ShipmentStatus::ReceivedAtHub->value, ShipmentStatus::SortedAtHub->value, ShipmentStatus::DispatchedFromHub->value], true)) {
                if ($task === null || $task->leg !== FulfillmentTaskLeg::FirstMile || $task->status !== FulfillmentTaskStatus::PickedUpFromSeller) {
                    throw FulfillmentException::conflict('HUB_STATE_CONFLICT', 'The first-mile task is not ready for this hub transition.');
                }
                $shipment->update(['status' => $target, 'revision' => $shipment->revision + 1]);
                if ($target === ShipmentStatus::DispatchedFromHub->value) {
                    $task = $this->createFinalTask($shipment);
                }
                $event = $this->event($shipment, $task, 'logistics_transition', $from->value, $target, $task?->courier_id, $logistics->id, null, null, ['request_hash' => $requestHash], $idempotencyKey, $input['reason'] ?? null);

                return ['shipment' => $shipment->fresh($this->shipmentRelations()), 'task' => $task?->fresh($this->taskRelations()), 'event' => $event];
            }

            $this->assertTaskTransition($task, $target);
            $order = $shipment->parcel->order()->lockForUpdate()->firstOrFail();
            $orderProjection = match ($target) {
                ShipmentStatus::InTransit->value => [OrderStatus::PickedUp, OrderStatus::InTransit],
                ShipmentStatus::OutForDelivery->value => [OrderStatus::InTransit, OrderStatus::OutForDelivery],
                default => null,
            };
            if ($orderProjection !== null && $order->status !== $orderProjection[0]) {
                throw FulfillmentException::conflict('ORDER_STATE_CONFLICT', 'The Order is not ready for this transition.');
            }
            if ($orderProjection !== null) {
                $this->orderTransitions->transition($order, $orderProjection[0], $orderProjection[1], 'logistics_update_status');
            }
            $at = now();
            $task->update(['status' => $target, $target === ShipmentStatus::InTransit->value ? 'in_transit_at' : ($target === ShipmentStatus::OutForDelivery->value ? 'out_for_delivery_at' : 'accepted_at') => $at, 'revision' => $task->revision + 1]);
            $shipment->update(['status' => $target, 'revision' => $shipment->revision + 1]);
            if ($target === ShipmentStatus::DispatchedFromHub->value) {
                $task = $this->createFinalTask($shipment);
            }
            $event = $this->event($shipment, $task, 'logistics_transition', $from->value, $target, $task?->courier_id, $logistics->id, null, null, ['request_hash' => $requestHash], $idempotencyKey, $input['reason'] ?? null);

            return ['shipment' => $shipment->fresh($this->shipmentRelations()), 'task' => $task?->fresh($this->taskRelations()), 'event' => $event];
        }, 3);
    }

    public function recordForLogistics(User $logistics, string $reference): Shipment
    {
        $org = $this->logisticsOrganization($logistics);
        $waybill = $this->resolveWaybill($org, $reference);
        $shipment = Shipment::query()->whereHas('parcel', fn ($query) => $query->where('waybill_id', $waybill->id))
            ->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id)->with($this->shipmentRelations())->first();
        if ($shipment === null) {
            $shipment = $this->ensureForWaybill($waybill);
        }

        return $shipment;
    }

    /**
     * Return the bounded, organization-scoped operational queue used by the
     * Logistics dashboard. Queue reads only include shared Shipment records
     * that already exist; they never lazily create physical records.
     *
     * @return array{paginator: \Illuminate\Contracts\Pagination\LengthAwarePaginator, summary: array<string, mixed>}
     */
    public function logisticsQueue(User $logistics, array $filters): array
    {
        $org = $this->logisticsOrganization($logistics);
        $query = Shipment::query()
            ->where('logistics_organization_id', $org->id)
            ->where('logistics_hub_id', $org->hub->id)
            ->whereNotIn('status', [ShipmentStatus::Delivered->value])
            ->when($filters['status'] ?? null, fn ($builder, $status) => $builder->where('status', $status instanceof ShipmentStatus ? $status->value : $status))
            ->when($filters['evidence_status'] ?? null, fn ($builder, $status) => $builder->whereHas('tasks.evidence', fn ($evidence) => $evidence->where('status', $status instanceof ShipmentEvidenceStatus ? $status->value : $status)))
            ->when($filters['search'] ?? null, function ($builder, $search): void {
                $term = mb_strtolower(trim((string) $search));
                $like = '%'.addcslashes($term, '%_').'%';
                $builder->where(function ($match) use ($term, $like): void {
                    if (Str::isUuid($term)) {
                        $match->where('shipments.id', $term)
                            ->orWhereHas('parcel', fn ($parcel) => $parcel->where('id', $term))
                            ->orWhereHas('parcel', fn ($parcel) => $parcel->whereRaw('LOWER(reference) LIKE ?', [$like]));
                    } else {
                        $match->whereHas('parcel', fn ($parcel) => $parcel->whereRaw('LOWER(reference) LIKE ?', [$like]));
                    }
                    $match->orWhereHas('parcel.order', fn ($order) => $order->whereRaw('LOWER(reference) LIKE ?', [$like]))
                        ->orWhereHas('parcel.waybill', fn ($waybill) => $waybill->whereRaw('LOWER(reference) LIKE ?', [$like]));
                });
            });

        $byStatus = (clone $query)
            ->select('status', DB::raw('COUNT(*) as aggregate'))
            ->groupBy('status')
            ->pluck('aggregate', 'status')
            ->map(fn ($count): int => (int) $count)
            ->all();
        $pendingEvidence = (clone $query)
            ->whereHas('tasks.evidence', fn ($evidence) => $evidence->whereIn('status', [ShipmentEvidenceStatus::Submitted->value, ShipmentEvidenceStatus::AwaitingValidation->value]))
            ->count();
        $pendingCompletion = (clone $query)
            ->whereHas('tasks.completionIntents', fn ($intent) => $intent->where('status', ShipmentEvidenceStatus::AwaitingValidation->value))
            ->count();

        $paginator = $query
            ->with($this->shipmentRelations())
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->paginate((int) ($filters['per_page'] ?? 25));

        return [
            'paginator' => $paginator,
            'summary' => [
                'total' => (int) $paginator->total(),
                'by_status' => $byStatus,
                'pending_evidence' => (int) $pendingEvidence,
                'pending_completion' => (int) $pendingCompletion,
            ],
        ];
    }

    public function ownedFinalTask(User $courier, string $taskId, bool $lock = false): DeliveryTask
    {
        $affiliation = $this->courierAffiliation($courier);
        $query = DeliveryTask::query()->whereKey($taskId)->where('leg', FulfillmentTaskLeg::FinalMile->value)->where('courier_id', $courier->id)
            ->whereHas('shipment', fn ($shipment) => $shipment->where('logistics_organization_id', $affiliation->logistics_organization_id)->where('logistics_hub_id', $affiliation->logistics_hub_id))->with($this->taskRelations());
        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->first() ?? throw FulfillmentException::notFound('TASK_NOT_FOUND', 'This final-mile task is not available.');
    }

    public function finalTasks(User $courier): Collection
    {
        $affiliation = $this->courierAffiliation($courier);

        return DeliveryTask::query()->where('leg', FulfillmentTaskLeg::FinalMile->value)->where('courier_id', $courier->id)
            ->whereHas('shipment', fn ($shipment) => $shipment->where('logistics_organization_id', $affiliation->logistics_organization_id)->where('logistics_hub_id', $affiliation->logistics_hub_id))
            ->whereIn('status', [FulfillmentTaskStatus::DeliveryAssigned->value, FulfillmentTaskStatus::DeliveryAccepted->value, FulfillmentTaskStatus::PickedUpFromHub->value, FulfillmentTaskStatus::InTransit->value, FulfillmentTaskStatus::OutForDelivery->value])
            ->with($this->taskRelations())->orderBy('created_at')->orderBy('id')->get();
    }

    public function completion(User $courier, string $taskId): array
    {
        $task = $this->ownedFinalTask($courier, $taskId);
        $intent = $task->completionIntents()->with('evidence')->latest('confirmed_at')->first();
        $evidence = $task->evidence()->where('purpose', ShipmentEvidencePurpose::DeliveryProof->value)->latest('submitted_at')->first();

        return ['task' => $task, 'intent' => $intent, 'evidence' => $evidence];
    }

    public function deliveredForCourier(User $courier, ?string $reference = null): Collection
    {
        $affiliation = $this->courierAffiliation($courier);

        return DeliveryTask::query()->where('leg', FulfillmentTaskLeg::FinalMile->value)->where('courier_id', $courier->id)->where('status', FulfillmentTaskStatus::Delivered->value)
            ->whereHas('shipment', fn ($shipment) => $shipment->where('logistics_organization_id', $affiliation->logistics_organization_id)->where('logistics_hub_id', $affiliation->logistics_hub_id))
            ->when($reference, fn ($query, $value) => $query->whereHas('shipment.parcel.order', fn ($order) => $order->where('reference', $value)))
            ->with($this->taskRelations())->orderByDesc('delivered_at')->orderByDesc('id')->get();
    }

    /** @return array<string, mixed> */
    public function taskProjection(DeliveryTask $task, bool $operator = false): array
    {
        $task->loadMissing($this->taskRelations());
        $parcel = $task->shipment?->parcel;
        $waybill = $parcel?->waybill;
        $order = $parcel?->order;
        $snapshot = $parcel?->snapshot ?? [];
        $pickup = $snapshot['waybill']['logistics']['hub_area'] ?? $snapshot['waybill']['pickup'] ?? null;
        $destination = $snapshot['destination'] ?? $snapshot['waybill']['recipient'] ?? null;
        $offers = $task->offers->sortBy('sequence')->values();
        $offer = $offers->sortByDesc('sequence')->first();
        $evidence = $task->evidence->sortByDesc('submitted_at')->values();
        $proof = $evidence->first(fn (ShipmentEvidence $item): bool => ($item->purpose instanceof ShipmentEvidencePurpose ? $item->purpose->value : $item->purpose) === ShipmentEvidencePurpose::DeliveryProof->value);
        $hubPickup = $evidence->first(fn (ShipmentEvidence $item): bool => ($item->purpose instanceof ShipmentEvidencePurpose ? $item->purpose->value : $item->purpose) === ShipmentEvidencePurpose::HubPickup->value);
        $intents = $task->completionIntents->sortBy('confirmed_at')->values();
        $intent = $intents->sortByDesc('confirmed_at')->first();

        $projection = [
            'task_id' => $task->id,
            'leg' => $task->leg instanceof FulfillmentTaskLeg ? $task->leg->value : $task->leg,
            'status' => $task->status instanceof FulfillmentTaskStatus ? $task->status->value : $task->status,
            'revision' => $task->revision,
            'courier_id' => $task->courier_id,
            'accepted_at' => $task->accepted_at?->toISOString(),
            'picked_up_at' => $task->picked_up_at?->toISOString(),
            'in_transit_at' => $task->in_transit_at?->toISOString(),
            'out_for_delivery_at' => $task->out_for_delivery_at?->toISOString(),
            'delivered_at' => $task->delivered_at?->toISOString(),
            'offer' => $offer ? [
                'id' => $offer->id,
                'status' => $offer->status instanceof FulfillmentOfferStatus ? $offer->status->value : $offer->status,
                'courier_id' => $offer->courier_id,
                'sequence' => $offer->sequence,
                'offered_at' => $offer->offered_at?->toISOString(),
                'responded_at' => $offer->responded_at?->toISOString(),
                'rejection_reason' => $offer->rejection_reason,
            ] : null,
            'order' => $order ? ['id' => $order->id, 'reference' => $order->reference, 'status' => $order->status?->value] : null,
            'waybill' => $waybill ? ['id' => $waybill->id, 'reference' => $waybill->reference] : null,
            'parcel' => $parcel ? ['id' => $parcel->id, 'reference' => $parcel->reference, 'item_count' => $parcel->item_count] : null,
            'pickup_area' => $this->area($pickup),
            'destination_area' => $this->area($destination),
            'evidence_status' => $proof?->status instanceof ShipmentEvidenceStatus ? $proof->status->value : ($proof?->status ?? 'unavailable'),
            'evidence_id' => $proof?->id,
            'completion_status' => $intent?->status instanceof ShipmentEvidenceStatus ? $intent->status->value : ($intent?->status ?? null),
        ];

        if ($operator) {
            $projection['courier'] = $this->courierProjection($task->courier);
            $projection['offer_history'] = $offers->map(fn (DeliveryTaskOffer $item): array => [
                'id' => $item->id,
                'status' => $item->status instanceof FulfillmentOfferStatus ? $item->status->value : $item->status,
                'courier_id' => $item->courier_id,
                'courier' => $this->courierProjection($item->courier),
                'sequence' => $item->sequence,
                'offered_at' => $item->offered_at?->toISOString(),
                'responded_at' => $item->responded_at?->toISOString(),
                'rejection_reason' => $item->rejection_reason,
            ])->all();
            $projection['evidence'] = $evidence->map(fn (ShipmentEvidence $item): array => $this->evidenceProjection($item))->all();
            $projection['completion_intents'] = $intents->map(fn (CompletionIntent $item): array => [
                'id' => $item->id,
                'evidence_id' => $item->shipment_evidence_id,
                'courier_id' => $item->courier_id,
                'expected_revision' => $item->expected_revision,
                'status' => $item->status instanceof ShipmentEvidenceStatus ? $item->status->value : $item->status,
                'confirmed_at' => $item->confirmed_at?->toISOString(),
                'validated_at' => $item->validated_at?->toISOString(),
            ])->all();
            $projection['hub_pickup_evidence'] = $hubPickup ? $this->evidenceProjection($hubPickup) : null;
            $projection['delivery_proof'] = $proof ? $this->evidenceProjection($proof) : null;
        }

        return $projection;
    }

    /**
     * Return the operational destination context that is only available after
     * the Courier has accepted the final-mile offer.
     *
     * The normal task projection intentionally exposes only an area summary so
     * an offered task can be reviewed safely. This projection is still limited
     * to the authenticated Courier's own task and the immutable checkout
     * snapshot; it never exposes private evidence or storage paths.
     *
     * @return array<string, mixed>
     */
    public function deliveryProjection(DeliveryTask $task): array
    {
        $projection = $this->taskProjection($task);
        $task->loadMissing(['shipment.hub.address', 'shipment.parcel.order.address']);

        $address = $task->shipment?->parcel?->order?->address;
        $hub = $task->shipment?->hub;

        $projection['pickup_hub'] = $hub ? [
            'name' => $hub->name,
            'address' => $hub->address ? $this->addressProjection($hub->address) : null,
        ] : null;
        $projection['destination'] = $address ? $this->addressProjection($address) : null;
        $projection['delivery_instructions'] = null;

        return $projection;
    }

    /** @return array<string, mixed> */
    public function shipmentProjection(Shipment $shipment): array
    {
        $shipment->loadMissing($this->shipmentRelations());
        $tasks = $shipment->tasks->sortBy(fn (DeliveryTask $task): string => $task->leg instanceof FulfillmentTaskLeg ? $task->leg->value : (string) $task->leg)->values();
        $allowed = match ($shipment->status) {
            ShipmentStatus::PickedUpFromSeller => ['received_at_hub'],
            ShipmentStatus::ReceivedAtHub => ['sorted_at_hub'],
            ShipmentStatus::SortedAtHub => ['dispatched_from_hub'],
            ShipmentStatus::DeliveryAccepted => ['picked_up_from_hub'],
            ShipmentStatus::PickedUpFromHub => ['in_transit'],
            ShipmentStatus::InTransit => ['out_for_delivery'],
            ShipmentStatus::OutForDelivery => ['delivered'],
            default => [],
        };

        return [
            'shipment_id' => $shipment->id,
            'status' => $shipment->status instanceof ShipmentStatus ? $shipment->status->value : $shipment->status,
            'revision' => $shipment->revision,
            'last_activity_at' => $this->lastActivityAt($shipment, $tasks),
            'parcel' => $shipment->parcel ? ['id' => $shipment->parcel->id, 'reference' => $shipment->parcel->reference, 'order_id' => $shipment->parcel->order_id, 'order_reference' => $shipment->parcel->order?->reference, 'waybill_reference' => $shipment->parcel->waybill?->reference, 'item_count' => $shipment->parcel->item_count] : null,
            'tasks' => $tasks->map(fn (DeliveryTask $task): array => $this->taskProjection($task, true))->values()->all(),
            'allowed_transitions' => $allowed,
        ];
    }

    /** @return array{id: string, name: string, email: string}|null */
    private function courierProjection(?User $courier): ?array
    {
        if ($courier === null) {
            return null;
        }

        $name = trim(implode(' ', array_filter([
            $courier->courierProfile?->first_name,
            $courier->courierProfile?->middle_name,
            $courier->courierProfile?->last_name,
        ])));

        return ['id' => $courier->id, 'name' => $name !== '' ? $name : $courier->email, 'email' => $courier->email];
    }

    /** @return array<string, mixed> */
    private function evidenceProjection(ShipmentEvidence $evidence): array
    {
        return [
            'id' => $evidence->id,
            'purpose' => $evidence->purpose instanceof ShipmentEvidencePurpose ? $evidence->purpose->value : $evidence->purpose,
            'type' => $evidence->type,
            'safe_reference' => $evidence->safe_reference,
            'status' => $evidence->status instanceof ShipmentEvidenceStatus ? $evidence->status->value : $evidence->status,
            'courier_id' => $evidence->courier_id,
            'submitted_at' => $evidence->submitted_at?->toISOString(),
            'validated_at' => $evidence->validated_at?->toISOString(),
            'rejection_reason' => $evidence->rejection_reason,
        ];
    }

    /** @param Collection<int, DeliveryTask> $tasks */
    private function lastActivityAt(Shipment $shipment, Collection $tasks): ?string
    {
        return collect([$shipment->updated_at, ...$tasks->pluck('updated_at')->all()])
            ->filter()
            ->sortByDesc(fn ($value) => $value->getTimestamp())
            ->first()?->toISOString();
    }

    /** @return array<string, string|null> */
    private function area(?array $address): array
    {
        return [
            'city_municipality' => $address['city_municipality'] ?? null,
            'province' => $address['province'] ?? null,
            'region' => $address['region'] ?? null,
            'postal_code' => $address['postal_code'] ?? null,
        ];
    }

    /** @return array<string, string|null> */
    private function addressProjection(object $address): array
    {
        return [
            'recipient_name' => $address->recipient_name,
            'contact_number' => $address->contact_number,
            'address_line_1' => $address->address_line_1,
            'address_line_2' => $address->address_line_2,
            'barangay' => $address->barangay,
            'city_municipality' => $address->city_municipality,
            'province' => $address->province,
            'region' => $address->region,
            'postal_code' => $address->postal_code,
            'country' => $address->country,
        ];
    }

    private function ensureForWaybillInTransaction(Waybill $waybill): Shipment
    {
        $waybill->loadMissing(['snapshot', 'order.items', 'order.address']);
        $parcel = Parcel::query()->where('waybill_id', $waybill->id)->lockForUpdate()->first();
        if ($parcel === null) {
            $existing = Parcel::query()->where('order_id', $waybill->order_id)->lockForUpdate()->first();
            if ($existing !== null && $existing->waybill_id !== $waybill->id) {
                throw FulfillmentException::conflict('PARCEL_IDENTITY_CONFLICT', 'The Order is already linked to another waybill.');
            }
            $parcel = $existing ?? Parcel::create([
                'order_id' => $waybill->order_id,
                'waybill_id' => $waybill->id,
                'reference' => 'PAR-'.$waybill->reference,
                'snapshot' => [
                    'schema_version' => 1,
                    'waybill' => $waybill->snapshot?->payload,
                    'destination' => $waybill->snapshot?->payload['recipient'] ?? null,
                    'items' => $waybill->order->items->map(fn ($item): array => ['name' => $item->product_name, 'variant_name' => $item->variant_name, 'quantity' => $item->quantity, 'sku' => $item->sku])->values()->all(),
                ],
                'item_count' => (int) $waybill->order->items->sum('quantity'),
            ]);
        }
        $legacy = FirstMileTask::query()->where('order_id', $waybill->order_id)->with('schedule')->orderByDesc('created_at')->first();
        $physicalState = match ($legacy?->status) {
            FirstMileTaskStatus::PickedUp => ShipmentStatus::PickedUpFromSeller,
            FirstMileTaskStatus::Accepted => ShipmentStatus::SellerPickupAccepted,
            FirstMileTaskStatus::Assigned => ShipmentStatus::SellerPickupAssigned,
            default => ShipmentStatus::AwaitingSellerPickup,
        };
        $shipment = Shipment::query()->where('parcel_id', $parcel->id)->lockForUpdate()->first();
        if ($shipment === null) {
            $shipment = Shipment::create(['parcel_id' => $parcel->id, 'logistics_organization_id' => $waybill->logistics_organization_id, 'logistics_hub_id' => $waybill->logistics_hub_id, 'status' => $physicalState, 'revision' => 1]);
        }
        $task = DeliveryTask::query()->where('shipment_id', $shipment->id)->where('leg', FulfillmentTaskLeg::FirstMile->value)->lockForUpdate()->first();
        if ($task === null && $legacy !== null) {
            $task = DeliveryTask::create([
                'shipment_id' => $shipment->id,
                'leg' => FulfillmentTaskLeg::FirstMile,
                'status' => match ($legacy->status) {
                    FirstMileTaskStatus::PickedUp => FulfillmentTaskStatus::PickedUpFromSeller,
                    FirstMileTaskStatus::Accepted => FulfillmentTaskStatus::SellerPickupAccepted,
                    default => FulfillmentTaskStatus::SellerPickupAssigned,
                },
                'courier_id' => $legacy->courier_id,
                'legacy_first_mile_task_id' => $legacy->id,
                'picked_up_at' => $legacy->picked_up_at,
            ]);
            $this->event($shipment, $task, 'legacy_import', null, $task->status->value, $legacy->courier_id, null, null, null, ['legacy_task_id' => $legacy->id]);
        }

        return $shipment->fresh($this->shipmentRelations());
    }

    private function createFinalTask(Shipment $shipment): DeliveryTask
    {
        return DeliveryTask::query()->firstOrCreate(
            ['shipment_id' => $shipment->id, 'leg' => FulfillmentTaskLeg::FinalMile->value],
            ['status' => FulfillmentTaskStatus::DeliveryAssigned, 'revision' => 1],
        );
    }

    private function finalizeDelivery(User $logistics, Shipment $shipment, ?DeliveryTask $task, ?ShipmentEvidence $evidence, string $requestHash, string $idempotencyKey, ?string $reason = null): array
    {
        if ($task === null || $task->leg !== FulfillmentTaskLeg::FinalMile || $task->status !== FulfillmentTaskStatus::OutForDelivery || $evidence?->purpose !== ShipmentEvidencePurpose::DeliveryProof) {
            throw FulfillmentException::conflict('COMPLETION_STATE_CONFLICT', 'The final-mile task is not ready for completion.');
        }
        $intent = CompletionIntent::query()->where('delivery_task_id', $task->id)->where('shipment_evidence_id', $evidence->id)->where('courier_id', $task->courier_id)->lockForUpdate()->latest('confirmed_at')->first();
        if ($intent === null) {
            throw FulfillmentException::conflict('COMPLETION_INTENT_REQUIRED', 'Courier completion intent is required before finalization.');
        }
        if ($intent->expected_revision !== $task->revision) {
            throw FulfillmentException::conflict('COMPLETION_STATE_CONFLICT', 'The completion intent is stale. Ask the Courier to confirm the current task revision.');
        }
        if ($evidence->status !== ShipmentEvidenceStatus::AwaitingValidation && $evidence->status !== ShipmentEvidenceStatus::Validated) {
            throw FulfillmentException::conflict('PROOF_NOT_VALIDATED', 'The delivery proof has not passed validation.');
        }
        $this->validateEvidence($evidence, $logistics);
        $order = $shipment->parcel->order()->lockForUpdate()->firstOrFail();
        if ($order->status !== OrderStatus::OutForDelivery) {
            throw FulfillmentException::conflict('ORDER_STATE_CONFLICT', 'The Order is not ready to be delivered.');
        }
        $this->orderTransitions->transition($order, OrderStatus::OutForDelivery, OrderStatus::Delivered, 'courier_complete_delivery');
        $order->loadMissing('shop.seller');
        DB::afterCommit(fn () => $order->shop?->seller?->notify(new SellerOrderDeliveredNotification($order)));
        $at = now();
        $task->update(['status' => FulfillmentTaskStatus::Delivered, 'delivered_at' => $at, 'revision' => $task->revision + 1]);
        $shipment->update(['status' => ShipmentStatus::Delivered, 'revision' => $shipment->revision + 1]);
        $intent->update(['status' => ShipmentEvidenceStatus::Validated, 'validated_at' => $at, 'validated_by_logistics_id' => $logistics->id]);
        $event = $this->event($shipment, $task, 'delivery_completed', ShipmentStatus::OutForDelivery->value, ShipmentStatus::Delivered->value, $task->courier_id, $logistics->id, $task->offers()->where('status', FulfillmentOfferStatus::Accepted->value)->latest('sequence')->first(), $evidence, ['request_hash' => $requestHash], $idempotencyKey, $reason);

        return ['shipment' => $shipment->fresh($this->shipmentRelations()), 'task' => $task->fresh($this->taskRelations()), 'event' => $event];
    }

    private function validateEvidence(ShipmentEvidence $evidence, User $logistics): void
    {
        $evidence->update(['status' => ShipmentEvidenceStatus::Validated, 'validated_at' => now(), 'validated_by_logistics_id' => $logistics->id, 'rejection_reason' => null]);
    }

    private function assertTaskTransition(?DeliveryTask $task, string $target): void
    {
        if ($task === null || $task->leg !== FulfillmentTaskLeg::FinalMile) {
            throw FulfillmentException::conflict('TASK_STATE_CONFLICT', 'A final-mile task is required for this transition.');
        }
        $allowed = [
            ShipmentStatus::InTransit->value => FulfillmentTaskStatus::PickedUpFromHub,
            ShipmentStatus::OutForDelivery->value => FulfillmentTaskStatus::InTransit,
        ];
        if (isset($allowed[$target]) && $task->status !== $allowed[$target]) {
            throw FulfillmentException::conflict('TASK_STATE_CONFLICT', 'The final-mile task is not ready for this transition.');
        }
    }

    private function taskForTransition(Shipment $shipment, string $target): ?DeliveryTask
    {
        if (in_array($target, [ShipmentStatus::ReceivedAtHub->value, ShipmentStatus::SortedAtHub->value, ShipmentStatus::DispatchedFromHub->value], true)) {
            return $shipment->tasks->firstWhere('leg', FulfillmentTaskLeg::FirstMile);
        }

        return $shipment->tasks->firstWhere('leg', FulfillmentTaskLeg::FinalMile);
    }

    private function allowedShipmentTransition(ShipmentStatus $from, string $target): bool
    {
        return match ($from) {
            ShipmentStatus::PickedUpFromSeller => $target === ShipmentStatus::ReceivedAtHub->value,
            ShipmentStatus::ReceivedAtHub => $target === ShipmentStatus::SortedAtHub->value,
            ShipmentStatus::SortedAtHub => $target === ShipmentStatus::DispatchedFromHub->value,
            ShipmentStatus::DeliveryAccepted => $target === ShipmentStatus::PickedUpFromHub->value,
            ShipmentStatus::PickedUpFromHub => $target === ShipmentStatus::InTransit->value,
            ShipmentStatus::InTransit => $target === ShipmentStatus::OutForDelivery->value,
            ShipmentStatus::OutForDelivery => $target === ShipmentStatus::Delivered->value,
            default => false,
        };
    }

    private function offerResult(DeliveryTaskOffer $offer): array
    {
        $task = $offer->task->fresh($this->taskRelations());

        return ['shipment' => $task->shipment, 'task' => $task, 'offer' => $offer->fresh(['courier.courierProfile'])];
    }

    private function event(Shipment $shipment, ?DeliveryTask $task, string $type, ?string $from, ?string $to, ?string $courierId, ?string $logisticsId, ?DeliveryTaskOffer $offer = null, ?ShipmentEvidence $evidence = null, ?array $metadata = null, ?string $idempotencyKey = null, ?string $reason = null): ShipmentEvent
    {
        return ShipmentEvent::create([
            'shipment_id' => $shipment->id,
            'delivery_task_id' => $task?->id,
            'delivery_task_offer_id' => $offer?->id,
            'shipment_evidence_id' => $evidence?->id,
            'event_type' => $type,
            'from_state' => $from,
            'to_state' => $to,
            'performing_courier_id' => $courierId,
            'recorded_by_logistics_id' => $logisticsId,
            'idempotency_key' => $idempotencyKey,
            'correlation_id' => (string) Str::uuid(),
            'reason' => $reason,
            'metadata' => $metadata,
            'occurred_at' => now(),
        ]);
    }

    private function resolveWaybill(LogisticsOrganization $org, string $reference): Waybill
    {
        $query = Waybill::query()->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id);
        $waybill = Str::isUuid($reference) ? (clone $query)->whereKey($reference)->first() : (clone $query)->where(function ($match) use ($reference) {
            $match->where('reference', $reference)->orWhereHas('order', fn ($order) => $order->where('reference', $reference));
        })->first();
        if ($waybill === null) {
            throw FulfillmentException::notFound('FULFILLMENT_NOT_FOUND', 'This parcel is not available to this Logistics organization.');
        }

        return $waybill->load(['snapshot', 'order.items', 'order.address']);
    }

    private function logisticsOrganization(User $logistics): LogisticsOrganization
    {
        $org = $logistics->logisticsOrganization()->with('hub')->first();
        if ($org === null || $org->hub === null) {
            throw FulfillmentException::notFound('LOGISTICS_SCOPE_INVALID', 'The Logistics organization or sole hub is unavailable.');
        }

        return $org;
    }

    private function courierAffiliation(User $courier): CourierLogisticsAffiliation
    {
        $affiliation = $courier->courierLogisticsAffiliation()->with('organization.user', 'hub')->first();
        if ($affiliation === null || $affiliation->status !== CourierAffiliationStatus::Approved || $affiliation->organization?->user?->status !== UserStatus::Active || $affiliation->hub === null) {
            throw FulfillmentException::notFound('TASK_NOT_FOUND', 'This Courier has no active Logistics assignment.');
        }

        return $affiliation;
    }

    private function assertCourier(string $courierId, string $orgId, string $hubId): void
    {
        $valid = CourierLogisticsAffiliation::query()->where('courier_id', $courierId)->where('logistics_organization_id', $orgId)->where('logistics_hub_id', $hubId)->where('status', CourierAffiliationStatus::Approved)->whereHas('courier', fn ($query) => $query->where('status', UserStatus::Active))->exists();
        if (! $valid) {
            throw FulfillmentException::invalid('COURIER_INELIGIBLE', 'The Courier is not an active approved member of this Logistics organization.', 'courier_id');
        }
    }

    private function identifierMatches(Waybill $waybill, $order, string $type, string $identifier): bool
    {
        return $type === 'qr'
            ? hash_equals($waybill->qr_token_hash, $this->waybillHasher->hashQr($identifier))
            : hash_equals(strtoupper((string) $order->reference), strtoupper($identifier));
    }

    private function hash(array $payload): string
    {
        return hash('sha256', json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
    }

    /** @return array<int, string> */
    private function shipmentRelations(): array
    {
        return ['parcel.order.items', 'parcel.order.address', 'parcel.waybill.snapshot', 'hub.address', 'tasks.courier.courierProfile', 'tasks.offers.courier.courierProfile', 'tasks.evidence', 'tasks.completionIntents.evidence'];
    }

    /** @return array<int, string> */
    private function taskRelations(): array
    {
        return ['shipment.parcel.order.items', 'shipment.parcel.order.address', 'shipment.parcel.waybill.snapshot', 'shipment.hub.address', 'shipment.tasks.offers.courier.courierProfile', 'offers.courier.courierProfile', 'courier.courierProfile', 'evidence', 'completionIntents.evidence'];
    }

    /** @return array<int, string> */
    private function evidenceRelations(): array
    {
        return ['task.shipment.parcel.order', 'offer.courier.courierProfile', 'validatedBy'];
    }

    /** @return array<int, string> */
    private function completionRelations(): array
    {
        return ['task.shipment.parcel.order', 'evidence', 'validatedBy'];
    }
}
