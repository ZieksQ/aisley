<?php

namespace App\Http\Controllers\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\StoreAddressRequest;
use App\Http\Resources\Customer\AddressResource;
use App\Services\Customer\AddressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AddressController extends Controller
{
    public function __construct(private readonly AddressService $addresses) {}

    public function index(Request $request): JsonResponse
    {
        return AddressResource::collection($this->addresses->list($request->user()))
            ->response()
            ->header('Cache-Control', 'no-store, private');
    }

    public function store(StoreAddressRequest $request): JsonResponse
    {
        return (new AddressResource($this->addresses->create($request->user(), $request->validated())))
            ->response()
            ->setStatusCode(201)
            ->header('Cache-Control', 'no-store, private');
    }
}
