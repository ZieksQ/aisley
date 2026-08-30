<?php

namespace App\Http\Resources\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AdminAccountResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'email' => $this->email,
            'role' => $this->role->value,
            'status' => $this->status->value,
            'profile' => [
                'first_name' => $this->adminProfile?->first_name,
                'last_name' => $this->adminProfile?->last_name,
                'middle_name' => $this->adminProfile?->middle_name,
                'contact_number' => $this->adminProfile?->contact_number,
                'sex' => $this->adminProfile?->sex?->value,
                'birth_date' => $this->adminProfile?->birth_date?->toDateString(),
                'profile_photo_url' => $this->adminProfile?->profile_photo_path
                    ? '/api/v1/admin/account/profile-photo?v='.$this->adminProfile->updated_at?->getTimestamp()
                    : null,
            ],
        ];
    }
}
