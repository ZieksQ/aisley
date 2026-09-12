<?php

namespace App\Http\Controllers\Courier;

use App\Http\Controllers\Controller;
use App\Services\Fulfillment\FulfillmentTransitionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeliveryHistoryController extends Controller
{
    public function index(Request $request, FulfillmentTransitionService $service): JsonResponse
    {
        $data = $request->validate(['reference' => ['nullable', 'string', 'max:128'], 'limit' => ['nullable', 'integer', 'min:1', 'max:50']]);
        $records = $service->deliveredForCourier($request->user(), $data['reference'] ?? null);
        $limit = $data['limit'] ?? 20;
        $items = $records->take($limit)->map(fn ($task) => $service->taskProjection($task))->values();

        return response()->json(['data' => $items, 'meta' => ['has_more' => $records->count() > $limit, 'next_cursor' => null]])
            ->header('Cache-Control', 'private, no-store');
    }

    public function show(Request $request, string $task, FulfillmentTransitionService $service): JsonResponse
    {
        $record = $service->ownedFinalTask($request->user(), $task);
        abort_unless($record->status->value === 'delivered', 404);

        return response()->json(['data' => $service->taskProjection($record)])->header('Cache-Control', 'private, no-store');
    }
}
