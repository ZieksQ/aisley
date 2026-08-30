<?php

namespace App\Http\Resources\Seller;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SellerUserResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'email' => $this->email,
            'role' => $this->role->value,
            'status' => $this->status->value,
            'profile' => $this->whenLoaded('sellerProfile', fn () => [
                'first_name' => $this->sellerProfile?->first_name,
                'last_name' => $this->sellerProfile?->last_name,
                'middle_name' => $this->sellerProfile?->middle_name,
                'contact_number' => $this->sellerProfile?->contact_number,
                'sex' => $this->sellerProfile?->sex?->value,
                'birth_date' => $this->sellerProfile?->birth_date?->toDateString(),
                'age' => $this->sellerProfile?->age,
                'profile_photo_path' => $this->sellerProfile?->profile_photo_path,
            ]),
            'shop' => $this->whenLoaded('shop', fn () => $this->shop ? [
                'id' => $this->shop->id,
                'name' => $this->shop->name,
                'status' => $this->shop->status->value,
                'category' => $this->shop->shopCategory ? [
                    'id' => $this->shop->shopCategory->id,
                    'name' => $this->shop->shopCategory->name,
                ] : null,
                'is_on_vacation' => $this->shop->is_on_vacation,
            ] : null),
        ];
    }
}
