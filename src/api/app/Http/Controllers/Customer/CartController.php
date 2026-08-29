<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\AddCartItemRequest;
use App\Http\Requests\Customer\UpdateCartItemRequest;
use App\Http\Resources\Customer\CartResource;
use App\Services\Customer\CartService;
use Illuminate\Http\Request;

class CartController extends Controller
{
    public function __construct(private readonly CartService $carts) {}

    public function show(Request $request): CartResource
    {
        return new CartResource($this->carts->show($request->user()));
    }

    public function store(AddCartItemRequest $request): CartResource
    {
        return new CartResource($this->carts->add($request->user(), $request->validated()));
    }

    public function update(UpdateCartItemRequest $request, string $item): CartResource
    {
        return new CartResource($this->carts->update($request->user(), $item, $request->validated()));
    }

    public function destroy(Request $request, string $item): CartResource
    {
        return new CartResource($this->carts->delete($request->user(), $item));
    }
}
