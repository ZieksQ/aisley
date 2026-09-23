<?php

namespace App\Services\Finance;

use App\Enums\UserStatus;
use App\Exceptions\Customer\CheckoutException;
use App\Models\Address;
use App\Models\ShippingRateVersion;
use App\Models\Shop;

class ShippingQuotationService
{
    /** @param list<array<string, mixed>> $lines @return array<string, mixed> */
    public function quote(Shop $shop, Address $destination, array $lines): array
    {
        $origin = $shop->seller->addresses()->where('is_default', true)->first();
        if ($origin === null) {
            throw CheckoutException::conflict('PICKUP_ADDRESS_REQUIRED', "{$shop->name} does not have a pickup address configured.", 'address_id');
        }

        $rate = ShippingRateVersion::query()
            ->where('status', 'published')
            ->whereNotNull('published_at')
            ->where('effective_at', '<=', now())
            ->with(['acceptances' => fn ($query) => $query
                ->whereNull('revoked_at')
                ->whereHas('organization.user', fn ($user) => $user->where('status', UserStatus::Active))
                ->whereHas('organization.hub')])
            ->get()
            ->filter(fn (ShippingRateVersion $candidate) => $this->matches($candidate, $origin, $destination))
            ->sortByDesc(fn (ShippingRateVersion $candidate) => sprintf('%02d-%010d', $this->specificity($candidate), $candidate->version_number))
            ->first();

        if ($rate === null) {
            throw CheckoutException::conflict('SHIPPING_RATE_UNAVAILABLE', "Shipping is not configured from {$origin->city_municipality} to {$destination->city_municipality}.", 'address_id');
        }

        $eligible = $rate->acceptances->pluck('logistics_organization_id')->unique()->sort()->values();
        if ($eligible->isEmpty()) {
            throw CheckoutException::conflict('SHIPPING_COVERAGE_UNAVAILABLE', 'No Logistics network currently honors the applicable shipping rate.', 'address_id');
        }

        $billable = 0;
        $inputs = [];
        foreach ($lines as $line) {
            $source = $line['variant'] ?? $line['product'];
            $measurements = collect(['weight_grams', 'length_mm', 'width_mm', 'height_mm'])
                ->mapWithKeys(function (string $field) use ($source, $line): array {
                    $column = 'shipping_'.$field;
                    $value = $source->{$column} ?? $line['product']->{$column};

                    return [$field => $value === null ? null : (int) $value];
                });
            if ($measurements->contains(fn ($value) => $value === null || $value < 1)) {
                throw CheckoutException::conflict('SHIPPING_DATA_REQUIRED', "Shipping weight and dimensions are missing for {$line['product']->name}.", 'items');
            }
            if ($measurements['length_mm'] > $rate->max_length_mm || $measurements['width_mm'] > $rate->max_width_mm || $measurements['height_mm'] > $rate->max_height_mm) {
                throw CheckoutException::conflict('SHIPPING_DIMENSIONS_UNSUPPORTED', "{$line['product']->name} exceeds the supported parcel dimensions.", 'items');
            }
            $volumetric = (int) ceil(($measurements['length_mm'] * $measurements['width_mm'] * $measurements['height_mm']) / $rate->volumetric_divisor);
            $unitBillable = max($measurements['weight_grams'], $volumetric);
            $lineBillable = $unitBillable * (int) $line['quantity'];
            $billable += $lineBillable;
            $inputs[] = [
                'product_id' => $line['product']->id, 'variant_id' => $line['variant']?->id,
                'quantity' => (int) $line['quantity'], ...$measurements->all(),
                'volumetric_weight_grams' => $volumetric, 'unit_billable_weight_grams' => $unitBillable,
                'line_billable_weight_grams' => $lineBillable,
            ];
        }
        if ($billable > $rate->max_weight_grams) {
            throw CheckoutException::conflict('SHIPPING_WEIGHT_UNSUPPORTED', 'The Shop order exceeds the supported billable weight.', 'items');
        }

        $excess = max(0, $billable - $rate->included_weight_grams);
        $steps = $excess === 0 ? 0 : (int) ceil($excess / $rate->additional_weight_grams);
        $additional = $steps * $rate->additional_fee_cents;
        $total = $rate->base_fee_cents + $additional + $rate->destination_surcharge_cents;

        return [
            'rate' => $rate, 'origin' => $this->address($origin), 'destination' => $this->address($destination),
            'line_inputs' => $inputs, 'billable_weight_grams' => $billable,
            'base_fee_cents' => $rate->base_fee_cents, 'additional_weight_fee_cents' => $additional,
            'destination_surcharge_cents' => $rate->destination_surcharge_cents, 'shipping_cents' => $total,
            'eligible_logistics_organization_ids' => $eligible->all(),
            'state' => [
                'rate_id' => $rate->id, 'rate_revision' => $rate->revision, 'published_at' => $rate->published_at?->getTimestamp(),
                'acceptances' => $rate->acceptances->map(fn ($acceptance) => [$acceptance->id, $acceptance->accepted_at?->getTimestamp()])->sort()->values()->all(),
                'origin' => [$origin->id, $origin->updated_at?->getTimestamp()], 'billable_weight_grams' => $billable,
            ],
        ];
    }

    private function matches(ShippingRateVersion $rate, Address $origin, Address $destination): bool
    {
        foreach (['region', 'province', 'city_municipality', 'barangay'] as $field) {
            foreach (['origin' => $origin, 'destination' => $destination] as $prefix => $address) {
                $expected = $rate->{$prefix.'_'.$field};
                if ($expected !== null && $this->normalize($expected) !== $this->normalize($address->{$field})) {
                    return false;
                }
            }
        }

        return true;
    }

    private function specificity(ShippingRateVersion $rate): int
    {
        return collect(['origin_region', 'origin_province', 'origin_city_municipality', 'origin_barangay', 'destination_region', 'destination_province', 'destination_city_municipality', 'destination_barangay'])
            ->filter(fn (string $field) => $rate->{$field} !== null)->count();
    }

    private function normalize(string $value): string
    {
        return mb_strtolower(trim($value));
    }

    /** @return array<string, mixed> */
    private function address(Address $address): array
    {
        return collect(['id', 'region', 'province', 'city_municipality', 'barangay', 'postal_code', 'country'])
            ->mapWithKeys(fn (string $field) => [$field => $address->{$field}])->all();
    }
}
