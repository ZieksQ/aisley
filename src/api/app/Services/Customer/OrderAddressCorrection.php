<?php

namespace App\Services\Customer;

use App\Exceptions\Customer\CheckoutException;
use App\Models\Address;
use App\Models\OrderAddress;

class OrderAddressCorrection
{
    private const LOCATION_FIELDS = [
        'address_line_1', 'address_line_2', 'barangay', 'city_municipality',
        'province', 'region', 'postal_code', 'country', 'latitude', 'longitude',
    ];

    public function assertAllowed(OrderAddress $current, Address $selected): void
    {
        foreach (array_diff(self::LOCATION_FIELDS, ['latitude', 'longitude']) as $field) {
            $before = trim((string) $current->{$field});
            $after = trim((string) $selected->{$field});
            if (($field !== 'address_line_2' && ($before === '' || $after === '')) || $before !== $after) {
                $this->rejectLocationChange();
            }
        }

        if (! $this->validCoordinates($current) || ! $this->validCoordinates($selected)) {
            $this->rejectLocationChange();
        }
        foreach (['latitude', 'longitude'] as $field) {
            if ($this->coordinate($current->{$field}) !== $this->coordinate($selected->{$field})) {
                $this->rejectLocationChange();
            }
        }

        if (trim($current->recipient_name) === trim($selected->recipient_name)
            && trim($current->contact_number) === trim($selected->contact_number)) {
            throw CheckoutException::conflict(
                'ADDRESS_UNCHANGED',
                'Select a saved address with a corrected recipient name or contact number.',
                'address_id',
            );
        }
    }

    /** @return array<string, mixed> */
    public function snapshot(OrderAddress $current, Address $selected): array
    {
        return [
            ...$current->only(self::LOCATION_FIELDS),
            'version' => $current->version + 1,
            'source_address_id' => $selected->id,
            'recipient_name' => trim($selected->recipient_name),
            'contact_number' => trim($selected->contact_number),
        ];
    }

    private function validCoordinates(OrderAddress|Address $address): bool
    {
        if ($address->latitude === null && $address->longitude === null) {
            return true;
        }

        return is_numeric($address->latitude) && is_numeric($address->longitude)
            && abs((float) $address->latitude) <= 90 && abs((float) $address->longitude) <= 180;
    }

    private function coordinate(?string $value): ?string
    {
        return $value === null ? null : number_format((float) $value, 7, '.', '');
    }

    private function rejectLocationChange(): never
    {
        throw CheckoutException::invalid(
            'ADDRESS_LOCATION_CHANGE_NOT_ALLOWED',
            'Only the recipient name and contact number can be corrected. Select a saved address at the same location and map pin.',
            'address_id',
        );
    }
}
