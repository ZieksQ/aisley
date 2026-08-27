<?php

namespace App\Http\Resources\Customer;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerUserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'email' => $this->email,
            'role' => $this->role->value,
            'status' => $this->status->value,
            'profile' => $this->whenLoaded('customerProfile', fn () => [
                'first_name' => $this->customerProfile?->first_name,
                'last_name' => $this->customerProfile?->last_name,
                'middle_name' => $this->customerProfile?->middle_name,
                'contact_number' => $this->customerProfile?->contact_number,
                'sex' => $this->customerProfile?->sex?->value,
                'birth_date' => $this->customerProfile?->birth_date?->toDateString(),
                'profile_photo_path' => $this->customerProfile?->profile_photo_path,
            ]),
        ];
    }
}
