<?php

namespace App\Http\Resources\Courier;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CourierAccountResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $profile = $this->courierProfile;
        $affiliation = $this->courierLogisticsAffiliation;

        return [
            'id' => $this->id,
            'email' => $this->email,
            'role' => $this->role?->value,
            'status' => $this->status?->value,
            'profile' => [
                'first_name' => $profile?->first_name,
                'middle_name' => $profile?->middle_name,
                'last_name' => $profile?->last_name,
                'contact_number' => $profile?->contact_number,
                'sex' => $profile?->sex?->value,
                'birth_date' => $profile?->birth_date?->toDateString(),
                'age' => $profile?->age,
                'profile_photo_url' => null,
            ],
            'affiliation' => [
                'status' => $affiliation?->status?->value,
                'organization_name' => $affiliation?->organization?->business_name,
                'hub_name' => $affiliation?->hub?->name,
            ],
            'security' => [
                'email_editable' => false,
                'profile_photo_editable' => false,
                'password_change_requires_current_password' => true,
            ],
        ];
    }
}
