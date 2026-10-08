<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Vouchers\AbstractVoucherController;
use App\Http\Requests\Seller\VoucherMutationRequest;
use App\Http\Resources\Seller\VoucherResource;
use Illuminate\Http\JsonResponse;

class VoucherController extends AbstractVoucherController
{
    protected function resource(): string
    {
        return VoucherResource::class;
    }

    public function store(VoucherMutationRequest $request): JsonResponse
    {
        return $this->mutation($request, 'create', null);
    }

    public function save(VoucherMutationRequest $request, string $voucher): JsonResponse
    {
        return $this->mutation($request, 'save', $voucher);
    }

    public function action(VoucherMutationRequest $request, string $voucher, string $operation): JsonResponse
    {
        return $this->mutation($request, $operation, $voucher);
    }
}
