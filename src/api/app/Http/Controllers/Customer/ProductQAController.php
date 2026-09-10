<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\AskProductQuestionRequest;
use App\Http\Requests\Customer\ListProductQuestionsRequest;
use App\Http\Resources\Customer\ProductQAResource;
use App\Models\Product;
use App\Models\ProductQA;
use App\Services\Customer\ProductQAService;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class ProductQAController extends Controller
{
    public function __construct(private readonly ProductQAService $questions) {}

    public function index(ListProductQuestionsRequest $request, string $product): Response
    {
        $visibleProduct = Product::query()->storefrontVisible()->whereKey($product)->firstOrFail();
        $questions = ProductQA::query()
            ->with('product.shop')
            ->where('product_id', $visibleProduct->id)
            ->orderByDesc('asked_at')
            ->orderByDesc('id')
            ->paginate($request->pageSize())
            ->withQueryString();

        return ProductQAResource::collection($questions)
            ->response()
            ->withHeaders([
                'Cache-Control' => 'public, max-age=30',
                'Vary' => 'Accept, Authorization, Cookie',
            ]);
    }

    public function store(AskProductQuestionRequest $request, string $product): JsonResponse
    {
        $question = $this->questions->ask(
            $request->user(),
            $product,
            $request->validated('question'),
            $request->idempotencyKey(),
        );

        return response()->json([
            'data' => new ProductQAResource($question),
        ], 201)->withHeaders(['Cache-Control' => 'no-store, private']);
    }
}
