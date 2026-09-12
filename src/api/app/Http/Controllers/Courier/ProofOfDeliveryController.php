<?php

namespace App\Http\Controllers\Courier;

use App\Enums\ShipmentEvidencePurpose;
use App\Http\Controllers\Controller;
use App\Http\Requests\Courier\FinalMileEvidenceRequest;
use App\Services\Fulfillment\FulfillmentTransitionService;
use Illuminate\Http\JsonResponse;

class ProofOfDeliveryController extends Controller
{
    public function store(FinalMileEvidenceRequest $request, string $task, FulfillmentTransitionService $service): JsonResponse
    {
        $evidence = $service->submitEvidence($request->user(), $task, $request->validated(), $request->idempotencyKey(), ShipmentEvidencePurpose::DeliveryProof);

        return response()->json(['data' => [
            'task_id' => $evidence->delivery_task_id,
            'proof_id' => $evidence->id,
            'evidence_status' => $evidence->status->value,
            'custody_state' => $evidence->task->status->value,
            'completion_eligible' => false,
            'submitted_at' => $evidence->submitted_at->toISOString(),
        ]], 202)->header('Cache-Control', 'private, no-store');
    }
}
