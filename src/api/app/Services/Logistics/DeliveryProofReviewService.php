<?php

namespace App\Services\Logistics;

use App\Enums\FulfillmentTaskStatus;
use App\Enums\ShipmentEvidenceStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\ShipmentEvidence;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class DeliveryProofReviewService
{
    public function reject(User $logistics, string $proofId, string $reason, int $revision): ShipmentEvidence
    {
        return DB::transaction(function () use ($logistics, $proofId, $reason, $revision): ShipmentEvidence {
            $org = $logistics->logisticsOrganization()->with('hub')->firstOrFail();
            $evidence = ShipmentEvidence::query()->whereKey($proofId)->where('purpose', 'delivery_proof')->where('type', 'photo')
                ->whereHas('task.shipment', fn ($query) => $query->where('current_logistics_organization_id', $org->id)->where('current_hub_id', $org->hub->id))
                ->lockForUpdate()->firstOrFail();
            $task = $evidence->task()->lockForUpdate()->firstOrFail();
            if ($evidence->status === ShipmentEvidenceStatus::Rejected && $evidence->rejection_reason === trim($reason)) {
                return $evidence;
            }
            if ($task->revision !== $revision || $task->status !== FulfillmentTaskStatus::OutForDelivery
                || $evidence->status !== ShipmentEvidenceStatus::AwaitingValidation) {
                throw FulfillmentException::conflict('PROOF_REVIEW_CONFLICT', 'The proof or delivery changed. Refresh before reviewing it.');
            }
            $evidence->update([
                'status' => ShipmentEvidenceStatus::Rejected,
                'rejection_reason' => trim($reason),
                'validated_by_logistics_id' => $logistics->id,
                'validated_at' => now(),
            ]);
            $task->completionIntents()->where('shipment_evidence_id', $evidence->id)
                ->where('status', ShipmentEvidenceStatus::AwaitingValidation->value)
                ->update(['status' => ShipmentEvidenceStatus::Rejected, 'validated_by_logistics_id' => $logistics->id, 'validated_at' => now()]);

            return $evidence->fresh();
        }, 3);
    }
}
