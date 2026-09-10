<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Controller;
use App\Http\Requests\Seller\AnswerProductQuestionRequest;
use App\Http\Resources\Customer\ProductQAResource;
use App\Models\ProductQA;
use App\Services\Customer\ProductQAService;
use Illuminate\Http\JsonResponse;

class ProductQAController extends Controller
{
    public function __construct(private readonly ProductQAService $questions) {}

    public function answer(AnswerProductQuestionRequest $request, ProductQA $question): JsonResponse
    {
        $result = $this->questions->answer(
            $request->user(),
            $question,
            $request->validated('answer'),
            $request->idempotencyKey(),
        );

        return response()->json([
            'data' => new ProductQAResource($result),
        ])->withHeaders(['Cache-Control' => 'no-store, private']);
    }
}
