<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\CheckoutQuoteRequest;
use App\Http\Requests\Customer\PlaceCheckoutRequest;
use App\Http\Resources\Customer\CheckoutBatchResource;
use App\Services\Customer\CheckoutService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CheckoutController extends Controller
{
    public function __construct(private readonly CheckoutService $checkout) {}

    public function quote(CheckoutQuoteRequest $request): JsonResponse
    {
        return response()->json(['data' => $this->checkout->quote($request->user(), $request->validated())])
            ->header('Cache-Control', 'no-store, private');
    }

    public function place(PlaceCheckoutRequest $request): CheckoutBatchResource
    {
        return new CheckoutBatchResource($this->checkout->place(
            $request->user(),
            $request->validated(),
            $request->idempotencyKey(),
        ));
    }

    public function show(Request $request, string $batch): CheckoutBatchResource
    {
        return new CheckoutBatchResource($this->checkout->batch($request->user(), $batch));
    }
}
