<?php

namespace App\Http\Controllers\Courier;

use App\Enums\FulfillmentTaskStatus;
use App\Enums\ShipmentEvidencePurpose;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Courier\FinalMileEvidenceRequest;
use App\Http\Requests\Courier\FinalMileStatusRequest;
use App\Http\Requests\Courier\RejectDeliveryTaskRequest;
use App\Services\Fulfillment\FulfillmentTransitionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FinalMileTaskController extends Controller
{
    public function index(Request $request, FulfillmentTransitionService $service): JsonResponse
    {
        return response()->json(['data' => $service->finalTasks($request->user())->map(fn ($task) => $service->taskProjection($task))->values()])
            ->header('Cache-Control', 'private, no-store');
    }

    public function show(Request $request, string $task, FulfillmentTransitionService $service): JsonResponse
    {
        $record = $service->ownedFinalTask($request->user(), $task);

        return response()->json(['data' => $service->taskProjection($record)])->header('Cache-Control', 'private, no-store');
    }

    /**
     * Delivery context is only available after the Courier accepts the offer.
     * The task detail endpoint above remains available for reviewing an offer.
     */
    public function delivery(Request $request, string $task, FulfillmentTransitionService $service): JsonResponse
    {
        $record = $service->ownedFinalTask($request->user(), $task);
        if (! in_array($record->status, [
            FulfillmentTaskStatus::DeliveryAccepted,
            FulfillmentTaskStatus::PickedUpFromHub,
            FulfillmentTaskStatus::InTransit,
            FulfillmentTaskStatus::OutForDelivery,
            FulfillmentTaskStatus::Delivered,
        ], true)) {
            throw FulfillmentException::conflict('TASK_NOT_ACCEPTED', 'Accept the final-mile offer before opening delivery context.');
        }

        return response()->json(['data' => $service->deliveryProjection($record)])->header('Cache-Control', 'private, no-store');
    }

    public function accept(Request $request, string $task, FulfillmentTransitionService $service): JsonResponse
    {
        $record = $service->acceptFinal($request->user(), $task);

        return response()->json(['data' => $service->taskProjection($record)])->header('Cache-Control', 'private, no-store');
    }

    public function reject(RejectDeliveryTaskRequest $request, string $task, FulfillmentTransitionService $service): JsonResponse
    {
        $record = $service->rejectFinal($request->user(), $task, $request->validated('reason'), $request->idempotencyKey());

        return response()->json(['data' => $service->taskProjection($record)])->header('Cache-Control', 'private, no-store');
    }

    public function pickup(FinalMileEvidenceRequest $request, string $task, FulfillmentTransitionService $service): JsonResponse
    {
        $evidence = $service->submitEvidence($request->user(), $task, $request->validated(), $request->idempotencyKey(), ShipmentEvidencePurpose::HubPickup);

        return response()->json(['data' => [
            'task_id' => $evidence->delivery_task_id,
            'evidence_id' => $evidence->id,
            'evidence_status' => $evidence->status->value,
            'custody_state' => $evidence->task->status->value,
            'submitted_at' => $evidence->submitted_at->toISOString(),
        ]], 202)->header('Cache-Control', 'private, no-store');
    }

    public function status(FinalMileStatusRequest $request, string $task, FulfillmentTransitionService $service): JsonResponse
    {
        $record = $service->transitionCourierStatus($request->user(), $task, $request->validated('target_state'), (int) $request->validated('expected_revision'), $request->idempotencyKey());

        return response()->json(['data' => $service->taskProjection($record)])->header('Cache-Control', 'private, no-store');
    }
}
