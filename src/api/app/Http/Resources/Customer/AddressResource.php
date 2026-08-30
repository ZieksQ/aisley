<?php

namespace App\Http\Resources\Customer;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AddressResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'label' => $this->label,
            'recipientName' => $this->recipient_name,
            'contactNumber' => $this->contact_number,
            'addressLine1' => $this->address_line_1,
            'addressLine2' => $this->address_line_2,
            'barangay' => $this->barangay,
            'cityMunicipality' => $this->city_municipality,
            'province' => $this->province,
            'region' => $this->region,
            'postalCode' => $this->postal_code,
            'country' => $this->country,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'isDefault' => $this->is_default,
        ];
    }
}
