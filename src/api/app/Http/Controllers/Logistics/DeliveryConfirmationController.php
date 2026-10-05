<?php

namespace App\Http\Controllers\Logistics;

use App\Http\Requests\Logistics\DeliveryConfirmationIndexRequest;
use App\Http\Resources\Logistics\DeliveryConfirmationResource;
use App\Services\Logistics\DeliveryConfirmationReadService;
use Illuminate\Http\JsonResponse;

class DeliveryConfirmationController
{
    public function index(DeliveryConfirmationIndexRequest $request, DeliveryConfirmationReadService $read): JsonResponse
    {
        $organization = $request->user()->logisticsOrganization()->with('hub')->firstOrFail();
        $page = $read->list($organization, $request->validated());

        return response()->json(['data' => DeliveryConfirmationResource::collection($page->items()), 'meta' => [
            'current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total(),
        ]])->header('Cache-Control', 'private, no-store');
    }
}
