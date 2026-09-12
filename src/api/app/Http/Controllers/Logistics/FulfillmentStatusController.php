<?php

namespace App\Http\Controllers\Logistics;

use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\TransitionFulfillmentRequest;
use App\Services\Fulfillment\FulfillmentTransitionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FulfillmentStatusController extends Controller
{
    public function show(Request $request, string $reference, FulfillmentTransitionService $service): JsonResponse
    {
        $shipment = $service->recordForLogistics($request->user(), $reference);

        return response()->json(['data' => $service->shipmentProjection($shipment)])
            ->header('Cache-Control', 'private, no-store');
    }

    public function transition(TransitionFulfillmentRequest $request, FulfillmentTransitionService $service): JsonResponse
    {
        $result = $service->transitionLogistics($request->user(), $request->validated(), $request->idempotencyKey());

        return response()->json([
            'data' => $service->shipmentProjection($result['shipment']),
            'event_id' => $result['event']->id,
        ])->header('Cache-Control', 'private, no-store');
    }
}
