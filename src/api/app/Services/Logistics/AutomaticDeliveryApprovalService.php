<?php

namespace App\Services\Logistics;

use App\Enums\DeliveryApprovalMode;
use App\Enums\ShipmentEvidenceStatus;
use App\Enums\ShipmentStatus;
use App\Enums\UserStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Jobs\Logistics\ApprovePrepaidDelivery;
use App\Models\CompletionIntent;
use App\Models\LogisticsOrganization;
use App\Models\Shipment;
use App\Services\Fulfillment\DeliveryFinalizationService;
use Illuminate\Support\Facades\DB;

class AutomaticDeliveryApprovalService
{
    public function approve(string $intentId): void
    {
        try {
            DB::transaction(function () use ($intentId): void {
                $identity = CompletionIntent::query()->with('task')->findOrFail($intentId);
                $shipment = Shipment::query()->whereKey($identity->task->shipment_id)->lockForUpdate()->firstOrFail();
                $task = $identity->task()->lockForUpdate()->firstOrFail();
                $proof = $identity->evidence()->lockForUpdate()->firstOrFail();
                $intent = CompletionIntent::query()->whereKey($intentId)->lockForUpdate()->firstOrFail();
                if ($intent->status !== ShipmentEvidenceStatus::AwaitingValidation || $intent->approval_mode !== DeliveryApprovalMode::Automatic || $intent->automatic_review_error !== null) {
                    return;
                }
                if ($shipment->current_logistics_organization_id !== $intent->review_organization_id || $shipment->current_hub_id !== $intent->review_hub_id
                    || $shipment->status !== ShipmentStatus::OutForDelivery || $shipment->condition_hold) {
                    throw FulfillmentException::conflict('AUTOMATIC_REVIEW_CONFLICT', 'Delivery context changed; Logistics review is required.');
                }
                $organization = LogisticsOrganization::query()->whereKey($intent->review_organization_id)
                    ->whereHas('user', fn ($q) => $q->where('status', UserStatus::Active->value))
                    ->whereHas('hub', fn ($q) => $q->whereKey($intent->review_hub_id))->first();
                if ($organization === null) {
                    throw FulfillmentException::conflict('AUTOMATIC_REVIEW_CONFLICT', 'Logistics authorization changed; manual review is required.');
                }
                app(DeliveryFinalizationService::class)->finalize(null, $shipment, $task, $proof, $intent->request_hash, $intent->id, null, $intent->id);
            }, 3);
        } catch (FulfillmentException $error) {
            CompletionIntent::query()->whereKey($intentId)->where('status', ShipmentEvidenceStatus::AwaitingValidation->value)
                ->update(['automatic_review_error' => $error->errorCode]);
            $intent = CompletionIntent::find($intentId);
            if ($intent?->status === ShipmentEvidenceStatus::AwaitingValidation) {
                app(LogisticsNotificationService::class)->queueCompletionRequested($intent);
            }
        }
    }

    public function recover(): void
    {
        CompletionIntent::query()->where('approval_mode', DeliveryApprovalMode::Automatic->value)
            ->where('status', ShipmentEvidenceStatus::AwaitingValidation->value)->whereNull('automatic_review_error')
            ->where('updated_at', '<=', now()->subMinutes(5))->orderBy('id')->each(function ($intent): void {
                $intent->touch();
                ApprovePrepaidDelivery::dispatch($intent->id);
            });
    }
}
