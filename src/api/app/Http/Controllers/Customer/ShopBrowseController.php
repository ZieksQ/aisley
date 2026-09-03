<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\ShopDirectoryRequest;
use App\Http\Requests\Customer\ShopProductsRequest;
use App\Http\Resources\Customer\ProductSummaryResource;
use App\Http\Resources\Customer\ShopCategorySummaryResource;
use App\Http\Resources\Customer\ShopDetailResource;
use App\Http\Resources\Customer\ShopSummaryResource;
use App\Services\Customer\ShopBrowseService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;

class ShopBrowseController extends Controller
{
    public function __construct(private readonly ShopBrowseService $browse) {}

    public function index(ShopDirectoryRequest $request): JsonResponse
    {
        $shops = $this->browse->directory($request->categorySlug(), $request->pageSize());

        return $this->publicResponse([
            'items' => ShopSummaryResource::collection($shops->getCollection()),
            'categories' => ShopCategorySummaryResource::collection($this->browse->directoryCategories()),
            'pagination' => $this->pagination($shops),
        ]);
    }

    public function show(string $slug): JsonResponse
    {
        return $this->publicResponse([
            'data' => new ShopDetailResource($this->browse->findPublicShop($slug)),
        ]);
    }

    public function products(ShopProductsRequest $request, string $slug): JsonResponse
    {
        $shop = $this->browse->findPublicShop($slug);
        $categories = $this->browse->productCategories($shop);
        $products = $this->browse->products(
            $shop,
            $categories,
            $request->categorySlug(),
            $request->pageSize(),
        );

        return $this->publicResponse([
            'shop' => new ShopDetailResource($shop),
            'categories' => ShopCategorySummaryResource::collection($categories),
            'items' => ProductSummaryResource::collection($products->getCollection()),
            'pagination' => $this->pagination($products),
        ]);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function publicResponse(array $payload): JsonResponse
    {
        return response()->json($payload)->withHeaders([
            'Cache-Control' => 'public, max-age=60',
            'Vary' => 'Accept, Authorization, Cookie',
        ]);
    }

    /**
     * @return array{currentPage: int, lastPage: int, perPage: int, total: int}
     */
    private function pagination(LengthAwarePaginator $paginator): array
    {
        return [
            'currentPage' => $paginator->currentPage(),
            'lastPage' => $paginator->lastPage(),
            'perPage' => $paginator->perPage(),
            'total' => $paginator->total(),
        ];
    }
}
