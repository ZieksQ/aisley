<?php

namespace App\Http\Resources\Seller;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SellerAccountResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'email' => $this->email,
            'role' => $this->role->value,
            'status' => $this->status->value,
            'profile' => [
                'first_name' => $this->sellerProfile?->first_name,
                'last_name' => $this->sellerProfile?->last_name,
                'middle_name' => $this->sellerProfile?->middle_name,
                'contact_number' => $this->sellerProfile?->contact_number,
                'sex' => $this->sellerProfile?->sex?->value,
                'birth_date' => $this->sellerProfile?->birth_date?->toDateString(),
                'profile_photo_url' => $this->sellerProfile?->profile_photo_path
                    ? '/api/v1/seller/account/profile-photo?v='.$this->sellerProfile->updated_at?->getTimestamp()
                    : null,
            ],
            'shop' => $this->shop ? [
                'id' => $this->shop->id,
                'name' => $this->shop->name,
                'slug' => $this->shop->slug,
                'status' => $this->shop->status->value,
                'description' => $this->shop->description,
                'contact_email' => $this->shop->contact_email,
                'contact_number' => $this->shop->contact_number,
                'website' => $this->shop->website,
                'is_on_vacation' => $this->shop->is_on_vacation,
                'vacation_message' => $this->shop->vacation_message,
            ] : null,
            'security' => [
                'two_factor_available' => false,
                'sensitive_edits_require_current_password' => true,
            ],
        ];
    }
}
