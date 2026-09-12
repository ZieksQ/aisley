<?php

namespace App\Http\Controllers\Courier;

use App\Http\Controllers\Controller;
use App\Http\Requests\Courier\CompleteDeliveryRequest;
use App\Services\Fulfillment\FulfillmentTransitionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CompleteDeliveryController extends Controller
{
    public function show(Request $request, string $task, FulfillmentTransitionService $service): JsonResponse
    {
        $result = $service->completion($request->user(), $task);
        $intent = $result['intent'];
        $evidence = $result['evidence'];

        return response()->json(['data' => [
            'task_id' => $result['task']->id,
            'intent_id' => $intent?->id,
            'task_status' => $result['task']->status->value,
            'order_status' => $result['task']->shipment->parcel->order->status->value,
            'evidence_id' => $evidence?->id,
            'evidence_status' => $evidence?->status?->value ?? 'unavailable',
            'completion_status' => $intent?->status?->value,
            'delivered_at' => $result['task']->delivered_at?->toISOString(),
            'revision' => $result['task']->revision,
        ]])->header('Cache-Control', 'private, no-store');
    }

    public function store(CompleteDeliveryRequest $request, string $task, FulfillmentTransitionService $service): JsonResponse
    {
        $intent = $service->submitCompletion($request->user(), $task, $request->validated('evidence_id'), (int) $request->validated('expected_revision'), $request->idempotencyKey());

        return response()->json(['data' => [
            'task_id' => $intent->delivery_task_id,
            'intent_id' => $intent->id,
            'task_status' => $intent->task->status->value,
            'order_status' => $intent->task->shipment->parcel->order->status->value,
            'evidence_status' => $intent->evidence->status->value,
            'completion_status' => $intent->status->value,
            'delivered_at' => null,
            'revision' => $intent->task->revision,
        ]], 202)->header('Cache-Control', 'private, no-store');
    }
}
