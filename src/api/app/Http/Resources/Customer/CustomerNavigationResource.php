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
            // Profile image delivery belongs to the account feature. The navbar
            // deliberately falls back to initials until it has a safe public URL.
            'avatarUrl' => null,
            'role' => $this->role->value,
            'status' => $this->status->value,
        ];
    }
}
