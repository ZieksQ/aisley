<?php

namespace App\Http\Controllers\Courier;

use App\Http\Controllers\Controller;
use App\Http\Requests\Courier\FailedDeliveryAttemptRequest;
use App\Services\Courier\FailedDeliveryAttemptService;
use Illuminate\Http\JsonResponse;

class FailedDeliveryAttemptController extends Controller
{
    public function store(FailedDeliveryAttemptRequest $request, string $task, FailedDeliveryAttemptService $service): JsonResponse
    {
        $attempt = $service->record($request->user(), $task, $request->validated(), $request->idempotencyKey());

        return response()->json(['data' => [
            'id' => $attempt->id,
            'task_id' => $attempt->delivery_task_id,
            'reason' => $attempt->reason,
            'note' => $attempt->note,
            'attempted_at' => $attempt->attempted_at->toISOString(),
            'retry_allowed' => true,
        ]], 201)->header('Cache-Control', 'private, no-store');
    }
}
