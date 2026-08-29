<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Controller;
use App\Http\Requests\Seller\DashboardRequest;
use App\Http\Resources\Seller\SellerDashboardResource;
use App\Models\User;
use App\Services\Seller\DashboardService;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function show(DashboardRequest $request, DashboardService $dashboard): JsonResponse
    {
        /** @var User $seller */
        $seller = $request->user();
        $resource = new SellerDashboardResource($dashboard->forSeller($seller, $request->validated()));

        return response()->json($resource->resolve($request));
    }
}
