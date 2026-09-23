<?php

namespace App\Http\Controllers\Logistics;

use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\LinehaulReceivingRequest;
use App\Services\Logistics\LinehaulReceivingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LinehaulReceivingController extends Controller
{
    public function show(Request $request, string $trip, LinehaulReceivingService $service): JsonResponse
    {
        return $this->response($service->detail($request->user(), $trip));
    }

    public function start(LinehaulReceivingRequest $request, string $trip, LinehaulReceivingService $service): JsonResponse
    {
        return $this->response($service->start($request->user(), $trip, $request->validated()));
    }

    public function batch(LinehaulReceivingRequest $request, string $trip, LinehaulReceivingService $service): JsonResponse
    {
        return $this->response($service->batch($request->user(), $trip, $request->validated('captures')));
    }

    public function finish(LinehaulReceivingRequest $request, string $trip, LinehaulReceivingService $service): JsonResponse
    {
        return $this->response($service->finish($request->user(), $trip, $request->validated()));
    }

    public function resolve(LinehaulReceivingRequest $request, string $trip, string $discrepancy, LinehaulReceivingService $service): JsonResponse
    {
        return $this->response($service->resolve($request->user(), $trip, $discrepancy, $request->validated()));
    }

    private function response(array $data): JsonResponse
    {
        return response()->json(['data' => $data])->header('Cache-Control', 'private, no-store');
    }
}
