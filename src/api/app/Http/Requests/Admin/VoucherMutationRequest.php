<?php

namespace App\Http\Requests\Admin;

class VoucherMutationRequest extends \App\Http\Requests\Vouchers\VoucherMutationRequest
{
    protected function benefits(): array
    {
        return ['discount', 'shipping'];
    }
}
