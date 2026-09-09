<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Controller;
use App\Http\Requests\Seller\AcceptSellerOrderRequest;
use App\Http\Requests\Seller\ListSellerOrdersRequest;
use App\Http\Requests\Seller\RejectSellerOrderRequest;
use App\Http\Requests\Seller\RequestSellerPickupRequest;
use App\Http\Resources\Seller\SellerOrderResource;
use App\Models\SellerPickupRequest;
use App\Models\User;
use App\Services\Logistics\EligibleLogisticsQuery;
use App\Services\Seller\AcceptSellerOrder;
use App\Services\Seller\RejectSellerOrder;
use App\Services\Seller\RequestSellerPickup;
use App\Services\Seller\SellerOrderService;
use App\Services\Waybills\WaybillPdfService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class OrderController extends Controller
{
    public function index(ListSellerOrdersRequest $request, SellerOrderService $orders): AnonymousResourceCollection
    {
        /** @var User $seller */
        $seller = $request->user();

        return SellerOrderResource::collection($orders->list($seller, $request->validated()))
            ->additional(['status_counts' => $orders->statusCounts($seller)]);
    }

    public function show(Request $request, string $order, SellerOrderService $orders): SellerOrderResource
    {
        /** @var User $seller */
        $seller = $request->user();

        return new SellerOrderResource($orders->detail($seller, $order));
    }

    public function accept(AcceptSellerOrderRequest $request, string $order, AcceptSellerOrder $accept): SellerOrderResource
    {
        /** @var User $seller */
        $seller = $request->user();

        return new SellerOrderResource($accept->handle($seller, $order, $request->idempotencyKey()));
    }

    public function reject(RejectSellerOrderRequest $request, string $order, RejectSellerOrder $reject): SellerOrderResource
    {
        /** @var User $seller */
        $seller = $request->user();

        return new SellerOrderResource($reject->handle($seller, $order, $request->idempotencyKey(), $request->validated('reason')));
    }

    public function requestPickup(RequestSellerPickupRequest $request, RequestSellerPickup $pickup): JsonResponse
    {
        /** @var User $seller */
        $seller = $request->user();
        $record = $pickup->handle($seller, $request->validated('order_ids'), $request->validated('logistics_organization_id'), $request->idempotencyKey());
        $waybillsByOrder = $record->waybills->keyBy('order_id');

        return response()->json(['data' => [
            'id' => $record->id,
            'status' => $record->status,
            'pickup_date' => $record->pickup_date?->toDateString(),
            'logistics_organization_id' => $record->logistics_organization_id,
            'order_ids' => $record->orders->pluck('order_id')->values(),
            'waybills' => $record->orders->map(fn ($link) => $waybillsByOrder->get($link->order_id))->filter()->map(fn ($waybill) => [
                'id' => $waybill->id,
                'order_id' => $waybill->order_id,
                'reference' => $waybill->reference,
                'created_at' => $waybill->created_at->toISOString(),
                'printable' => true,
            ])->values(),
        ]]);
    }

    public function logisticsOptions(Request $request, EligibleLogisticsQuery $query): JsonResponse
    {
        /** @var User $seller */
        $seller = $request->user();
        $result = $query->forSeller($seller->id);

        return response()->json(['data' => $result['options'], 'meta' => [
            'distance_unit' => 'km',
            'distance_provider' => 'Geoapify Route Matrix',
            'attribution' => ['Geoapify', 'OpenStreetMap contributors'],
        ]]);
    }

    public function waybill(Request $request, string $order, SellerOrderService $orders, WaybillPdfService $pdf)
    {
        /** @var User $seller */
        $seller = $request->user();
        $record = $orders->detail($seller, $order);
        $waybill = $record->waybill()->with('snapshot')->first();
        if (! $waybill) {
            return response()->json([
                'code' => 'WAYBILL_NOT_AVAILABLE',
                'message' => 'A waybill is not available for this Order.',
            ], 404);
        }

        $disposition = $request->query('disposition') === 'inline' ? 'inline' : 'attachment';

        return $pdf->response(collect([$waybill]), $seller, $disposition === 'inline' ? 'view' : 'download', $disposition);
    }

    public function pickupWaybills(Request $request, string $pickup, WaybillPdfService $pdf)
    {
        /** @var User $seller */
        $seller = $request->user();
        $record = SellerPickupRequest::query()->where('seller_id', $seller->id)->whereKey($pickup)->firstOrFail();
        $waybills = $record->waybills()->with('snapshot')
            ->join('seller_pickup_request_orders', function ($join) use ($record) {
                $join->on('seller_pickup_request_orders.order_id', '=', 'waybills.order_id')
                    ->where('seller_pickup_request_orders.seller_pickup_request_id', '=', $record->id);
            })
            ->select('waybills.*')->orderBy('seller_pickup_request_orders.position')->orderBy('waybills.id')->get();
        abort_if($waybills->isEmpty(), 404);

        return $pdf->response($waybills, $seller, 'bulk_download');
    }
}
