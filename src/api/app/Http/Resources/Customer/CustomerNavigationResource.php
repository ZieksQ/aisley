<?php

namespace App\Http\Resources\Customer;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerNavigationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $profile = $this->customerProfile;
        $displayName = trim(implode(' ', array_filter([
            $profile?->first_name,
            $profile?->last_name,
        ])));

        return [
            'id' => $this->id,
            'displayName' => $displayName !== '' ? $displayName : null,
            'avatarUrl' => $profile?->profile_photo_disk && $profile->profile_photo_path
                ? '/api/v1/customer/account/profile-photo?v='.$profile->updated_at?->getTimestamp()
                : null,
            'role' => $this->role->value,
            'status' => $this->status->value,
        ];
    }
}
