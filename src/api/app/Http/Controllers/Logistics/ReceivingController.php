<?php

namespace App\Http\Controllers\Logistics;

use App\Exceptions\Fulfillment\FulfillmentException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\BulkReceiveAtHubRequest;
use App\Services\Fulfillment\FulfillmentTransitionService;
use Illuminate\Http\JsonResponse;

class ReceivingController extends Controller
{
    public function store(BulkReceiveAtHubRequest $request, FulfillmentTransitionService $service): JsonResponse
    {
        $results = collect($request->validated('receipts'))->map(function (array $receipt) use ($request, $service): array {
            try {
                $result = $service->receiveAtHub($request->user(), $receipt['reference'], $receipt['client_id'], $receipt['scanned_at']);

                return ['client_id' => $receipt['client_id'], 'reference' => $receipt['reference'], 'status' => 'received', 'shipment' => $service->shipmentProjection($result['shipment'])];
            } catch (FulfillmentException $exception) {
                return ['client_id' => $receipt['client_id'], 'reference' => $receipt['reference'], 'status' => 'failed', 'code' => $exception->errorCode, 'message' => $exception->getMessage()];
            }
        })->values();

        return response()->json(['data' => $results, 'summary' => ['received' => $results->where('status', 'received')->count(), 'failed' => $results->where('status', 'failed')->count()]])
            ->header('Cache-Control', 'private, no-store');
    }
}
