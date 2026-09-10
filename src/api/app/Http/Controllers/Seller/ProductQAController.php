<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Controller;
use App\Http\Requests\Seller\AnswerProductQuestionRequest;
use App\Http\Requests\Seller\ListProductQuestionsRequest;
use App\Http\Resources\Seller\SellerProductQAResource;
use App\Models\ProductQA;
use App\Models\User;
use App\Services\Customer\ProductQAService;
use App\Services\Seller\SellerShopService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductQAController extends Controller
{
    public function __construct(private readonly ProductQAService $questions) {}

    public function index(ListProductQuestionsRequest $request, SellerShopService $shops): JsonResponse
    {
        /** @var User $seller */
        $seller = $request->user();
        $shop = $shops->for($seller);
        $status = $request->validated('status', 'all');

        $questions = ProductQA::query()
            ->with(['product:id,shop_id,name,slug,status,published_at', 'product.shop:id,name,seller_id'])
            ->whereHas('product', fn ($product) => $product->where('shop_id', $shop->id))
            ->when($request->validated('product'), fn ($query, $product) => $query->whereHas(
                'product',
                fn ($products) => $products->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($product).'%']),
            ))
            ->when($status === 'unanswered', fn ($query) => $query->whereNull('answer_text'))
            ->when($status === 'answered', fn ($query) => $query->whereNotNull('answer_text'))
            ->orderByRaw('CASE WHEN answer_text IS NULL THEN 0 ELSE 1 END')
            ->orderByDesc('asked_at')
            ->orderByDesc('id')
            ->paginate($request->pageSize())
            ->withQueryString();

        return SellerProductQAResource::collection($questions)
            ->response()
            ->header('Cache-Control', 'no-store, private');
    }

    public function show(Request $request, string $question, SellerShopService $shops): JsonResponse
    {
        /** @var User $seller */
        $seller = $request->user();
        $shop = $shops->for($seller);
        $record = ProductQA::query()
            ->with(['product:id,shop_id,name,slug,status,published_at', 'product.shop:id,name,seller_id'])
            ->whereKey($question)
            ->whereHas('product', fn ($product) => $product->where('shop_id', $shop->id))
            ->firstOrFail();

        return (new SellerProductQAResource($record))
            ->response()
            ->header('Cache-Control', 'no-store, private');
    }

    public function answer(AnswerProductQuestionRequest $request, ProductQA $question): JsonResponse
    {
        $result = $this->questions->answer(
            $request->user(),
            $question,
            $request->validated('answer'),
            $request->idempotencyKey(),
        );

        return response()->json([
            'data' => new SellerProductQAResource($result),
        ])->withHeaders(['Cache-Control' => 'no-store, private']);
    }
}
