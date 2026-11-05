<?php

namespace App\Http\Resources\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SellerComplianceSellerOptionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'email' => $this->email,
            'name' => trim(($this->sellerProfile?->first_name ?? '').' '.($this->sellerProfile?->last_name ?? '')) ?: $this->email,
            'status' => $this->status->value,
            'shop_name' => $this->shop?->name,
            'contact_number' => $this->sellerProfile?->contact_number,
            'shop_status' => $this->shop?->status->value,
            'joined_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
