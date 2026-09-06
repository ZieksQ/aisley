<?php

namespace App\Http\Requests\Seller;

class RejectSellerOrderRequest extends AcceptSellerOrderRequest
{
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'reason' => ['nullable', 'string', 'max:500'],
        ];
    }
}
