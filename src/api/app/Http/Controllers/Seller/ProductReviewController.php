<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Controller;
use App\Http\Requests\Seller\ListProductReviewsRequest;
use App\Http\Requests\Seller\StoreProductReviewResponseRequest;
use App\Http\Resources\Seller\SellerProductReviewResource;
use App\Models\User;
use App\Services\Seller\ProductReviewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductReviewController extends Controller
{
    public function __construct(private readonly ProductReviewService $reviews) {}

    public function index(ListProductReviewsRequest $request): JsonResponse
    {
        /** @var User $seller */
        $seller = $request->user();
        $reviews = $this->reviews->list($seller, $request->safe()->only(['status', 'product', 'rating']), $request->pageSize());

        return SellerProductReviewResource::collection($reviews)
            ->additional(['filters' => ['products' => $this->reviews->productOptions($seller)]])
            ->response()
            ->withHeaders(['Cache-Control' => 'no-store, private', 'Pragma' => 'no-cache']);
    }

    public function show(Request $request, string $review): JsonResponse
    {
        /** @var User $seller */
        $seller = $request->user();

        return (new SellerProductReviewResource($this->reviews->find($seller, $review)))
            ->response()
            ->withHeaders(['Cache-Control' => 'no-store, private', 'Pragma' => 'no-cache']);
    }

    public function respond(StoreProductReviewResponseRequest $request, string $review): JsonResponse
    {
        /** @var User $seller */
        $seller = $request->user();
        $result = $this->reviews->respond(
            $seller,
            $review,
            (string) $request->validated('response'),
            $request->idempotencyKey(),
        );

        return response()->json([
            'data' => new SellerProductReviewResource($result['review']),
        ], $result['created'] ? 201 : 200)->withHeaders([
            'Cache-Control' => 'no-store, private',
            'Pragma' => 'no-cache',
        ]);
    }
}
