<?php

namespace App\Http\Controllers\Courier;

use App\Http\Controllers\Controller;
use App\Http\Requests\Courier\PickupDecisionRequest;
use App\Services\Courier\PickupDecisionService;
use Illuminate\Http\JsonResponse;

class PickupDecisionController extends Controller
{
    public function failed(PickupDecisionRequest $request, string $task, PickupDecisionService $service): JsonResponse
    {
        return $this->decide($request, $task, 'failed_pickup', $service);
    }

    public function reject(PickupDecisionRequest $request, string $schedule, PickupDecisionService $service): JsonResponse
    {
        return $this->decide($request, $schedule, 'rejected', $service);
    }

    private function decide(PickupDecisionRequest $request, string $target, string $action, PickupDecisionService $service): JsonResponse
    {
        $result = $service->handle($request->user(), $target, $action, $request->validated('reason'), (string) $request->header('Idempotency-Key'));

        return response()->json(['data' => $result])->header('Cache-Control', 'private, no-store');
    }
}
