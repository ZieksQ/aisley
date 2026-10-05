<?php

namespace App\Http\Controllers\Logistics;

use App\Http\Requests\Logistics\CourierCashIndexRequest;
use App\Http\Requests\Logistics\CourierCashReceiptRequest;
use App\Http\Resources\Logistics\CourierCashObligationResource;
use App\Http\Resources\Logistics\CourierCashReceiptResource;
use App\Models\CourierCashReceipt;
use App\Services\Finance\CourierCashReadService;
use App\Services\Finance\CourierCashService;

class CourierCashController
{
    public function index(CourierCashIndexRequest $request, CourierCashReadService $read)
    {
        $organization = $request->user()->logisticsOrganization()->firstOrFail();
        $page = $read->outstanding($organization->id, $request->validated())->orderBy('delivered_at')->orderBy('id')->paginate($request->integer('per_page', 20));

        return response()->json(['data' => CourierCashObligationResource::collection($page->items()),
            'balances' => $read->balances($organization->id),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()]])->header('Cache-Control', 'private, no-store');
    }

    public function receipts(CourierCashIndexRequest $request)
    {
        $organization = $request->user()->logisticsOrganization()->firstOrFail();
        $page = CourierCashReceipt::query()->where('logistics_organization_id', $organization->id)->with(['items.obligation', 'credit'])
            ->when($request->validated('courier_id'), fn ($q, $id) => $q->where('courier_id', $id))
            ->latest('received_at')->orderByDesc('id')->paginate($request->integer('per_page', 20));

        return response()->json(['data' => CourierCashReceiptResource::collection($page->items()),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()]])->header('Cache-Control', 'private, no-store');
    }

    public function receive(CourierCashReceiptRequest $request, CourierCashService $service)
    {
        $receipt = $service->receive($request->user(), $request->validated('obligation_ids'), $request->validated('idempotency_key'));

        return response()->json(['data' => new CourierCashReceiptResource($receipt)], 200)->header('Cache-Control', 'private, no-store');
    }
}
