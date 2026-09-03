<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\ProductSummaryResolveRequest;
use App\Http\Requests\Customer\RecentlyViewedListRequest;
use App\Http\Requests\Customer\RecentlyViewedMergeRequest;
use App\Http\Resources\Customer\ProductSummaryResource;
use App\Http\Resources\Customer\RecentlyViewedItemResource;
use App\Services\Customer\RecentlyViewedService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RecentlyViewedController extends Controller
{
    public function __construct(private readonly RecentlyViewedService $recentlyViewed) {}

    public function index(RecentlyViewedListRequest $request): Response
    {
        return RecentlyViewedItemResource::collection($this->recentlyViewed->list(
            $request->user(),
            $request->pageSize(),
            $request->cursor(),
        ))->response()->withHeaders($this->privateHeaders());
    }

    public function store(Request $request, string $product): JsonResponse
    {
        $item = $this->recentlyViewed->record($request->user(), $product);

        return response()->json(['data' => [
            'productId' => $item->product_id,
            'lastViewedAt' => $item->last_viewed_at->toISOString(),
        ]])->withHeaders($this->privateHeaders());
    }

    public function merge(RecentlyViewedMergeRequest $request): JsonResponse
    {
        $mergedIds = $this->recentlyViewed->merge($request->user(), $request->validated('items'));

        return response()->json(['data' => [
            'mergedProductIds' => $mergedIds,
            'mergedCount' => count($mergedIds),
        ]])->withHeaders($this->privateHeaders());
    }

    public function destroy(Request $request, string $product): JsonResponse
    {
        $removed = $this->recentlyViewed->remove($request->user(), $product);

        return response()->json(['data' => [
            'productId' => $product,
            'removed' => $removed,
        ]])->withHeaders($this->privateHeaders());
    }

    public function clear(Request $request): JsonResponse
    {
        $removedCount = $this->recentlyViewed->clear($request->user());

        return response()->json(['data' => [
            'cleared' => true,
            'removedCount' => $removedCount,
        ]])->withHeaders($this->privateHeaders());
    }

    public function resolve(ProductSummaryResolveRequest $request): JsonResponse
    {
        return response()->json([
            'items' => ProductSummaryResource::collection(
                $this->recentlyViewed->resolveProducts($request->validated('productIds')),
            ),
        ])->withHeaders([
            'Cache-Control' => 'public, max-age=60',
            'Vary' => 'Accept, Authorization, Cookie',
        ]);
    }

    /**
     * @return array<string, string>
     */
    private function privateHeaders(): array
    {
        return ['Cache-Control' => 'no-store, private'];
    }
}
