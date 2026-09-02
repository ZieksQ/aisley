<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\WishlistMutationRequest;
use App\Http\Requests\Customer\WishlistStatusRequest;
use App\Http\Resources\Customer\WishlistItemResource;
use App\Models\Product;
use App\Services\Customer\WishlistService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class WishlistController extends Controller
{
    public function __construct(private readonly WishlistService $wishlist) {}

    public function index(Request $request): Response
    {
        return WishlistItemResource::collection($this->wishlist->list($request->user()))
            ->response()
            ->withHeaders(['Cache-Control' => 'no-store, private']);
    }

    public function store(WishlistMutationRequest $request, Product $product): JsonResponse
    {
        $item = $this->wishlist->save($request->user(), $product->id);

        return response()->json([
            'data' => [
                'productId' => $product->id,
                'saved' => true,
                'savedAt' => $item->created_at->toISOString(),
            ],
        ])->withHeaders(['Cache-Control' => 'no-store, private']);
    }

    public function destroy(WishlistMutationRequest $request, string $product): JsonResponse
    {
        $this->wishlist->remove($request->user(), $product);

        return response()->json([
            'data' => ['productId' => $product, 'saved' => false],
        ])->withHeaders(['Cache-Control' => 'no-store, private']);
    }

    public function status(WishlistStatusRequest $request): JsonResponse
    {
        return response()->json([
            'data' => $this->wishlist->status($request->user(), $request->validated('product_ids')),
        ])->withHeaders(['Cache-Control' => 'no-store, private']);
    }
}
