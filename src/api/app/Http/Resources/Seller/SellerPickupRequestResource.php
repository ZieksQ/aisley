<?php

namespace App\Http\Resources\Seller;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SellerPickupRequestResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $orderCount = (int) ($this->orders_count ?? $this->orders()->count());
        $pickedUpCount = (int) ($this->picked_up_order_count ?? 0);

        return [
            'id' => $this->id,
            'status' => $this->status->value,
            'collection_status' => $pickedUpCount === 0 ? null
                : ($pickedUpCount === $orderCount ? 'picked_up' : 'partially_picked_up'),
            'requested_at' => $this->created_at->toIso8601String(),
            'pickup_date' => $this->pickup_date?->toDateString(),
            'order_count' => $orderCount,
            'provider' => $this->organization === null ? null : [
                'id' => $this->organization->id,
                'business_name' => $this->organization->business_name,
            ],
        ];
    }
}
