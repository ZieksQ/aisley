<?php

namespace App\Http\Resources\Logistics;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PickupScheduleDetailResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $profile = $this->courier?->courierProfile;

        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'status' => $this->status->value,
            'starts_at' => $this->starts_at->toISOString(),
            'parcel_count' => $this->orders->count(),
            'courier' => [
                'id' => $this->courier_id,
                'name' => trim(($profile?->first_name ?? '').' '.($profile?->last_name ?? '')),
                'email' => $this->courier?->email,
            ],
            'pickup_requests' => $this->orders->sortBy('id')->groupBy('seller_pickup_request_id')->map(function ($links): array {
                $pickup = $links->first()->sellerPickupRequest;

                return [
                    'id' => $pickup->id,
                    'shop' => ['id' => $pickup->shop_id, 'name' => $pickup->shop?->name],
                    'orders' => $links->map(fn ($link): array => [
                        'id' => $link->order_id,
                        'reference' => $link->order?->reference,
                        'status' => $link->order?->status?->value,
                        'waybill' => $link->order?->waybill ? [
                            'id' => $link->order->waybill->id,
                            'reference' => $link->order->waybill->reference,
                        ] : null,
                    ])->values(),
                ];
            })->sortBy('shop.name')->values(),
        ];
    }
}
