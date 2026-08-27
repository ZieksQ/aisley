<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\ProductSearchRequest;
use App\Http\Resources\Customer\ProductSummaryResource;
use App\Services\Customer\ProductSearchService;
use Illuminate\Http\JsonResponse;

class ProductSearchController extends Controller
{
    public function __construct(private readonly ProductSearchService $search) {}

    public function __invoke(ProductSearchRequest $request): JsonResponse
    {
        $products = $this->search->search($request->queryText(), $request->pageSize());

        return response()->json([
            'query' => $request->queryText(),
            'items' => ProductSummaryResource::collection($products->getCollection()),
            'pagination' => [
                'currentPage' => $products->currentPage(),
                'lastPage' => $products->lastPage(),
                'perPage' => $products->perPage(),
                'total' => $products->total(),
            ],
        ])->withHeaders([
            'Cache-Control' => 'public, max-age=60',
            'Vary' => 'Accept, Authorization, Cookie',
        ]);
    }
}
