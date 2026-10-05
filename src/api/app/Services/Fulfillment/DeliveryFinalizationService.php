<?php

namespace App\Services\Fulfillment;

use App\Enums\CourierAffiliationStatus;
use App\Enums\DeliveryApprovalMode;
use App\Enums\FulfillmentOfferStatus;
use App\Enums\FulfillmentTaskLeg;
use App\Enums\FulfillmentTaskStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\ShipmentEvidencePurpose;
use App\Enums\ShipmentEvidenceStatus;
use App\Enums\ShipmentStatus;
use App\Enums\UserStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\CompletionIntent;
use App\Models\CourierLogisticsAffiliation;
use App\Models\DeliveryTask;
use App\Models\FinalMileFailedAttempt;
use App\Models\Shipment;
use App\Models\ShipmentEvent;
use App\Models\ShipmentEvidence;
use App\Models\User;
use App\Notifications\Seller\SellerOrderDeliveredNotification;
use App\Services\Finance\Automation\CodInvoiceService;
use App\Services\Finance\CourierCashService;
use App\Services\Finance\FinanceLifecycleService;
use App\Services\OrderTransitionService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class DeliveryFinalizationService
{
    public function __construct(private readonly OrderTransitionService $orderTransitions, private readonly FinanceLifecycleService $finance) {}

    // Caller holds the Shipment lock in a transaction. All completion paths use Shipment → Task → Proof → Intent → Order.
    public function finalize(?User $logistics, Shipment $shipment, ?DeliveryTask $task, ?ShipmentEvidence $evidence, string $requestHash, string $idempotencyKey, ?string $reason = null, ?string $expectedIntentId = null): array
    {
        if ($task !== null) {
            $task = DeliveryTask::query()->whereKey($task->id)->lockForUpdate()->firstOrFail();
        }
        if ($evidence !== null) {
            $evidence = ShipmentEvidence::query()->whereKey($evidence->id)->lockForUpdate()->firstOrFail();
        }
        if ($task === null || $evidence?->delivery_task_id !== $task->id || $evidence?->courier_id !== $task->courier_id || $task->leg !== FulfillmentTaskLeg::FinalMile || $task->status !== FulfillmentTaskStatus::OutForDelivery || $evidence?->purpose !== ShipmentEvidencePurpose::DeliveryProof || $evidence->type !== 'photo' || ! $evidence->storage_disk || ! $evidence->storage_path || ! Storage::disk($evidence->storage_disk)->exists($evidence->storage_path)) {
            throw FulfillmentException::conflict('COMPLETION_STATE_CONFLICT', 'The final-mile task is not ready for completion.');
        }
        $failedAttemptCount = FinalMileFailedAttempt::query()->where('delivery_task_id', $task->id)->count();
        if (($evidence->metadata['failed_attempt_count'] ?? -1) !== $failedAttemptCount) {
            throw FulfillmentException::conflict('PROOF_STALE_AFTER_FAILED_ATTEMPT', 'The Courier must submit a new photo after the failed attempt.');
        }
        $intent = CompletionIntent::query()->where('delivery_task_id', $task->id)->where('shipment_evidence_id', $evidence->id)->where('courier_id', $task->courier_id)->lockForUpdate()->latest('confirmed_at')->first();
        if ($intent === null || ($expectedIntentId !== null && $intent->id !== $expectedIntentId) || $intent->status !== ShipmentEvidenceStatus::AwaitingValidation) {
            throw FulfillmentException::conflict('COMPLETION_INTENT_REQUIRED', 'Courier completion intent is required before finalization.');
        }
        if ($intent->expected_revision !== $task->revision) {
            throw FulfillmentException::conflict('COMPLETION_STATE_CONFLICT', 'The completion intent is stale. Ask the Courier to confirm the current task revision.');
        }
        $affiliated = CourierLogisticsAffiliation::query()->where('courier_id', $task->courier_id)
            ->where('logistics_organization_id', $shipment->current_logistics_organization_id)
            ->where('logistics_hub_id', $shipment->current_hub_id)->where('status', CourierAffiliationStatus::Approved->value)->exists();
        $active = User::query()->whereKey($task->courier_id)->where('status', UserStatus::Active->value)->exists();
        if (! $affiliated || ! $active) {
            throw FulfillmentException::conflict('COURIER_AUTHORIZATION_CHANGED', 'The assigned Courier is no longer authorized.');
        }
        $order = $shipment->parcel->order()->lockForUpdate()->firstOrFail();
        if ($logistics === null && ($intent->approval_mode !== DeliveryApprovalMode::Automatic || $order->payment_method === PaymentMethod::CashOnDelivery)) {
            throw FulfillmentException::conflict('MANUAL_REVIEW_REQUIRED', 'This delivery requires Logistics review.');
        }
        if ($order->payment_method === PaymentMethod::Prepaid && $order->payment_status !== PaymentStatus::Paid) {
            throw FulfillmentException::conflict('PREPAID_PAYMENT_REQUIRED', 'Prepaid delivery requires a confirmed paid Order.');
        }
        if ($order->payment_method === PaymentMethod::CashOnDelivery) {
            if ($intent->cod_declared_at === null || $intent->cod_declared_amount === null || $intent->cod_currency !== $order->currency
                || ! hash_equals((string) $intent->cod_declared_amount, (string) $order->payable_total) || $order->payment_status !== PaymentStatus::Pending) {
                throw FulfillmentException::conflict('COD_DECLARATION_INVALID', 'COD collection declaration is missing or does not match the Order amount.');
            }
        }
        if ($evidence->status !== ShipmentEvidenceStatus::AwaitingValidation && $evidence->status !== ShipmentEvidenceStatus::Validated) {
            throw FulfillmentException::conflict('PROOF_NOT_VALIDATED', 'The delivery proof has not passed validation.');
        }
        $method = $logistics === null ? DeliveryApprovalMode::Automatic : DeliveryApprovalMode::Manual;
        $evidence->update(['status' => ShipmentEvidenceStatus::Validated, 'validated_at' => now(),
            'validated_by_logistics_id' => $logistics?->id, 'review_method' => $method, 'rejection_reason' => null]);
        if ($order->status !== OrderStatus::OutForDelivery) {
            throw FulfillmentException::conflict('ORDER_STATE_CONFLICT', 'The Order is not ready to be delivered.');
        }
        $this->orderTransitions->transition($order, OrderStatus::OutForDelivery, OrderStatus::Delivered, 'courier_complete_delivery');
        if ($order->payment_method === PaymentMethod::CashOnDelivery) {
            $order->update(['payment_status' => PaymentStatus::Paid]);
        }
        $order->loadMissing('shop.seller');
        DB::afterCommit(fn () => $order->shop?->seller?->notify(new SellerOrderDeliveredNotification($order)));
        $at = now();
        $task->update(['status' => FulfillmentTaskStatus::Delivered, 'delivered_at' => $at, 'revision' => $task->revision + 1]);
        $shipment->update(['status' => ShipmentStatus::Delivered, 'revision' => $shipment->revision + 1]);
        // The existing financial recognition workflow posts a COD receivable.
        // Prepaid capture and settlement are outside this fulfillment revision.
        if ($order->payment_method === PaymentMethod::CashOnDelivery) {
            $this->finance->recognizeDelivery($order, $shipment, $at);
            app(CodInvoiceService::class)->issue($order, $shipment->current_logistics_organization_id, $at);
        }
        $intent->update(['status' => ShipmentEvidenceStatus::Validated, 'validated_at' => $at, 'validated_by_logistics_id' => $logistics?->id, 'review_method' => $method, 'automatic_review_error' => null]);
        app(CourierCashService::class)->recordDelivery($order, $task, $shipment->current_logistics_organization_id, $at);
        $event = ShipmentEvent::create([
            'shipment_id' => $shipment->id, 'delivery_task_id' => $task->id,
            'delivery_task_offer_id' => $task->offers()->where('status', FulfillmentOfferStatus::Accepted->value)->latest('sequence')->value('id'),
            'shipment_evidence_id' => $evidence->id, 'event_type' => 'delivery_completed',
            'from_state' => ShipmentStatus::OutForDelivery->value, 'to_state' => ShipmentStatus::Delivered->value,
            'performing_courier_id' => $task->courier_id, 'recorded_by_logistics_id' => $logistics?->id,
            'metadata' => ['request_hash' => $requestHash, 'review_method' => $method->value,
                'cod_collector_organization_id' => $shipment->current_logistics_organization_id],
            'idempotency_key' => $idempotencyKey, 'reason' => $reason,
            'correlation_id' => (string) Str::uuid(), 'occurred_at' => $at,
        ]);

        return ['shipment' => $shipment->fresh(), 'task' => $task->fresh(), 'event' => $event];
    }
}
