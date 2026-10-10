<?php

namespace App\Services\Customer;

use App\Models\Address;

class CheckoutAddressFingerprint
{
    /** @return array<string, mixed> */
    public function state(Address $address): array
    {
        // Hash persisted delivery values: timestamps alone miss same-second edits.
        return [
            'id' => $address->id,
            'updated_at' => $address->updated_at?->getTimestamp(),
            'type' => $address->type->value,
            'label' => $address->label,
            'recipient_name' => $address->recipient_name,
            'contact_number' => $address->contact_number,
            'address_line_1' => $address->address_line_1,
            'address_line_2' => $address->address_line_2,
            'barangay' => $address->barangay,
            'city_municipality' => $address->city_municipality,
            'province' => $address->province,
            'region' => $address->region,
            'postal_code' => $address->postal_code,
            'country' => $address->country,
            'latitude' => $address->latitude,
            'longitude' => $address->longitude,
        ];
    }
}
