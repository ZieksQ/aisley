<?php

namespace App\Http\Resources\Customer;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerAccountResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $profile = $this->customerProfile;

        return [
            'id' => $this->id,
            'email' => $this->email,
            'role' => $this->role->value,
            'status' => $this->status->value,
            'profile' => [
                'firstName' => $profile?->first_name,
                'middleName' => $profile?->middle_name,
                'lastName' => $profile?->last_name,
                'contactNumber' => $profile?->contact_number,
                'sex' => $profile?->sex?->value,
                'birthDate' => $profile?->birth_date?->toDateString(),
                'age' => $profile?->age,
            ],
            'security' => [
                'emailEditable' => false,
                'passwordChangeRequiresCurrentPassword' => true,
            ],
        ];
    }
}
