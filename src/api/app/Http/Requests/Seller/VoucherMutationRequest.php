<?php

namespace App\Http\Requests\Seller;

class VoucherMutationRequest extends \App\Http\Requests\Vouchers\VoucherMutationRequest
{
    protected function benefits(): array
    {
        return ['discount'];
    }
}
