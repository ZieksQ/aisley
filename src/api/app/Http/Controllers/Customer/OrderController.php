<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\ListOrdersRequest;
use App\Http\Requests\Customer\ListOrderTrackingRequest;
use App\Http\Resources\Customer\OrderResource;
use App\Http\Resources\Customer\OrderSummaryResource;
use App\Http\Resources\Customer\OrderTrackingResource;
use App\Services\Customer\CustomerOrderStatusMapper;
use App\Services\Customer\OrderTrackingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function __construct(
        private readonly OrderTrackingService $orders,
        private readonly CustomerOrderStatusMapper $statuses,
    ) {}

    public function index(ListOrdersRequest $request): JsonResponse
    {
        $group = $request->group();
        $resource = OrderSummaryResource::collection(
            $this->orders->orders($request->user(), $group, $request->pageSize()),
        )->additional([
            'filters' => [
                'selected' => $group?->value,
                'tabs' => $this->statuses->tabs(),
            ],
        ]);

        return $resource->response()->header('Cache-Control', 'no-store, private');
    }

    public function show(Request $request, string $order): JsonResponse
    {
        return (new OrderResource($this->orders->order($request->user(), $order)))
            ->response()
            ->header('Cache-Control', 'no-store, private');
    }

    public function tracking(ListOrderTrackingRequest $request, string $order): JsonResponse
    {
        return OrderTrackingResource::collection(
            $this->orders->tracking($request->user(), $order, $request->pageSize()),
        )->response()->header('Cache-Control', 'no-store, private');
    }
}
