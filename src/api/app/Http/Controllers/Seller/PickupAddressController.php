<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Controller;
use App\Http\Requests\Seller\StorePickupAddressRequest;
use App\Http\Requests\Seller\UpdatePickupAddressRequest;
use App\Http\Resources\Seller\PickupAddressResource;
use App\Services\Seller\PickupAddressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PickupAddressController extends Controller
{
    public function __construct(private readonly PickupAddressService $addresses) {}

    public function index(Request $request): JsonResponse
    {
        return PickupAddressResource::collection($this->addresses->list($request->user()))
            ->response()->header('Cache-Control', 'no-store, private');
    }

    public function store(StorePickupAddressRequest $request): JsonResponse
    {
        return (new PickupAddressResource($this->addresses->create($request->user(), $request->validated())))
            ->response()->setStatusCode(201)->header('Cache-Control', 'no-store, private');
    }

    public function update(UpdatePickupAddressRequest $request, string $address): JsonResponse
    {
        return (new PickupAddressResource($this->addresses->update($request->user(), $address, $request->validated())))
            ->response()->header('Cache-Control', 'no-store, private');
    }

    public function destroy(Request $request, string $address): JsonResponse
    {
        $this->addresses->delete($request->user(), $address);

        return response()->json(null, 204)->header('Cache-Control', 'no-store, private');
    }
}
