<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\ListProductReviewsRequest;
use App\Http\Requests\Customer\StoreProductReviewRequest;
use App\Http\Requests\Customer\UploadProductReviewImageRequest;
use App\Http\Resources\Customer\ProductReviewImageResource;
use App\Http\Resources\Customer\ProductReviewResource;
use App\Models\Product;
use App\Services\Customer\ProductReviewService;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class ProductReviewController extends Controller
{
    public function __construct(private readonly ProductReviewService $reviews) {}

    public function index(ListProductReviewsRequest $request, string $product): Response
    {
        $visibleProduct = Product::query()->storefrontVisible()->whereKey($product)->firstOrFail();
        $reviews = $this->reviews->list($visibleProduct, $request->pageSize());

        return ProductReviewResource::collection($reviews)
            ->additional(['summary' => $this->reviews->summary($visibleProduct)])
            ->response()
            ->withHeaders([
                'Cache-Control' => 'public, max-age=30',
                'Vary' => 'Accept, Authorization, Cookie',
            ]);
    }

    public function store(StoreProductReviewRequest $request, string $orderItem): JsonResponse
    {
        $result = $this->reviews->create(
            $request->user(),
            $orderItem,
            (int) $request->validated('rating'),
            (string) $request->validated('body'),
        );

        return response()->json([
            'data' => new ProductReviewResource($result['review']),
        ], $result['created'] ? 201 : 200)->withHeaders([
            'Cache-Control' => 'no-store, private',
            'Pragma' => 'no-cache',
        ]);
    }

    public function uploadImage(UploadProductReviewImageRequest $request, string $review): JsonResponse
    {
        $image = $this->reviews->uploadImage($request->user(), $review, $request->file('image'));

        return response()->json([
            'data' => new ProductReviewImageResource($image),
        ], 201)->withHeaders([
            'Cache-Control' => 'no-store, private',
            'Pragma' => 'no-cache',
        ]);
    }
}
