<?php

namespace App\Http\Controllers\Logistics;

use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\HubTransferRequest;
use App\Services\Fulfillment\FulfillmentTransitionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HubRoutingController extends Controller
{
    public function show(Request $request, string $reference, FulfillmentTransitionService $service): JsonResponse
    {
        return response()->json(['data' => $service->routeForLogistics($request->user(), $reference)])->header('Cache-Control', 'private, no-store');
    }

    public function depart(HubTransferRequest $request, FulfillmentTransitionService $service): JsonResponse
    {
        return $this->transfer($request, $service, false);
    }

    public function arrive(HubTransferRequest $request, FulfillmentTransitionService $service): JsonResponse
    {
        return $this->transfer($request, $service, true);
    }

    private function transfer(HubTransferRequest $request, FulfillmentTransitionService $service, bool $arrival): JsonResponse
    {
        return response()->json(['data' => $service->transferAtHub($request->user(), $request->validated(), (string) $request->header('Idempotency-Key'), $arrival)])->header('Cache-Control', 'private, no-store');
    }
}
