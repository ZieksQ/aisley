<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\ShopSearchRequest;
use App\Http\Resources\Customer\ShopSummaryResource;
use App\Services\Customer\ShopSearchService;
use Illuminate\Http\JsonResponse;

class ShopSearchController extends Controller
{
    public function __invoke(ShopSearchRequest $request, ShopSearchService $search): JsonResponse
    {
        $shops = $search->search($request->queryText(), $request->pageSize());

        return response()->json([
            'query' => $request->queryText(),
            'items' => ShopSummaryResource::collection($shops->getCollection()),
            'pagination' => [
                'currentPage' => $shops->currentPage(),
                'lastPage' => $shops->lastPage(),
                'perPage' => $shops->perPage(),
                'total' => $shops->total(),
            ],
        ])->withHeaders([
            'Cache-Control' => 'public, max-age=60',
            'Vary' => 'Accept, Authorization, Cookie',
        ]);
    }
}
