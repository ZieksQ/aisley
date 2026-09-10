<?php

namespace App\Http\Resources\Logistics;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LogisticsAccountResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $profile = $this->logisticsProfile;
        $organization = $this->logisticsOrganization;
        $hub = $organization?->hub;
        $address = $hub?->address;

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
                'profile_photo_url' => $profile?->profile_photo_disk && $profile->profile_photo_path
                    ? '/api/v1/logistics/account/profile-photo?v='.$profile->updated_at?->getTimestamp()
                    : null,
            ],
            'organization' => [
                'id' => $organization?->id,
                'business_name' => $organization?->business_name,
            ],
            'hub' => [
                'id' => $hub?->id,
                'name' => $hub?->name,
                'address' => $address ? [
                    'address_line_1' => $address->address_line_1,
                    'address_line_2' => $address->address_line_2,
                    'barangay' => $address->barangay,
                    'city_municipality' => $address->city_municipality,
                    'province' => $address->province,
                    'region' => $address->region,
                    'postal_code' => $address->postal_code,
                    'country' => $address->country,
                ] : null,
            ],
            'security' => [
                'email_editable' => false,
                'profile_photo_editable' => true,
                'password_change_requires_current_password' => true,
                'organization_editable' => true,
                'hub_name_editable' => true,
                'hub_address_editable' => false,
            ],
        ];
    }
}
