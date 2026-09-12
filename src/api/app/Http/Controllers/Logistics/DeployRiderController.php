<?php

namespace App\Http\Controllers\Logistics;

use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\OfferDeliveryTaskRequest;
use App\Models\DeliveryTask;
use App\Services\Fulfillment\FulfillmentTransitionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeployRiderController extends Controller
{
    public function candidates(Request $request, string $task, FulfillmentTransitionService $service): JsonResponse
    {
        $record = DeliveryTask::query()->whereKey($task)->first();
        if ($record === null) {
            abort(404);
        }

        return response()->json(['data' => $service->candidates($request->user(), $record)->values()])
            ->header('Cache-Control', 'private, no-store');
    }

    public function offer(OfferDeliveryTaskRequest $request, string $task, FulfillmentTransitionService $service): JsonResponse
    {
        $result = $service->offerFinal($request->user(), $task, $request->validated('courier_id'), (int) $request->validated('expected_task_revision'), $request->idempotencyKey());

        return response()->json([
            'data' => [
                'task' => $service->taskProjection($result['task']),
                'offer' => [
                    'id' => $result['offer']->id,
                    'status' => $result['offer']->status->value,
                    'courier_id' => $result['offer']->courier_id,
                    'sequence' => $result['offer']->sequence,
                    'offered_at' => $result['offer']->offered_at?->toISOString(),
                ],
            ],
        ], 201)->header('Cache-Control', 'private, no-store');
    }
}
