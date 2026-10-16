<?php

namespace App\Http\Resources\Seller;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SellerPickupRequestResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status->value,
            'requested_at' => $this->created_at->toIso8601String(),
            'pickup_date' => $this->pickup_date?->toDateString(),
            'order_count' => (int) ($this->orders_count ?? $this->orders()->count()),
            'provider' => $this->organization === null ? null : [
                'id' => $this->organization->id,
                'business_name' => $this->organization->business_name,
            ],
        ];
    }
}
