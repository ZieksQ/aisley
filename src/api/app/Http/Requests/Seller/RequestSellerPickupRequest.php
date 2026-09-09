<?php

namespace App\Http\Requests\Seller;

class RequestSellerPickupRequest extends AcceptSellerOrderRequest
{
    public function rules(): array
    {
        return [
            'order_ids' => ['required', 'array', 'min:1', 'max:50'],
            'order_ids.*' => ['required', 'uuid', 'distinct'],
            'pickup_date' => ['prohibited'],
            'logistics_organization_id' => ['required', 'uuid'],
            'status' => ['prohibited'],
        ];
    }
}
