<?php

namespace App\Http\Controllers\Logistics;

use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\ListFulfillmentQueueRequest;
use App\Models\User;
use App\Services\Fulfillment\FulfillmentTransitionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $hub = $user->logisticsOrganization()->with('hub.address')->firstOrFail()->hub;

        return response()->json(['hub' => ['id' => $hub->id, 'name' => $hub->name, 'address' => ['barangay' => $hub->address->barangay, 'city_municipality' => $hub->address->city_municipality, 'province' => $hub->address->province, 'region' => $hub->address->region]], 'summary' => null, 'orders' => [], 'freshness' => ['generated_at' => now()->toIso8601String(), 'state' => 'scaffold']])->header('Cache-Control', 'private, no-store');
    }

    public function queue(ListFulfillmentQueueRequest $request, FulfillmentTransitionService $service): JsonResponse
    {
        $result = $service->logisticsQueue($request->user(), $request->validated());
        $paginator = $result['paginator'];

        return response()->json([
            'data' => collect($paginator->items())->map(fn ($shipment): array => $service->shipmentProjection($shipment))->values(),
            'summary' => $result['summary'],
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
            'freshness' => [
                'generated_at' => now()->toIso8601String(),
                'state' => 'authoritative',
            ],
        ])->header('Cache-Control', 'private, no-store')->header('Pragma', 'no-cache');
    }
}
