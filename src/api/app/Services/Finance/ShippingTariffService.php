<?php

namespace App\Services\Finance;

use App\Enums\UserRole;
use App\Models\ShippingRateVersion;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ShippingTariffService
{
    /** @param array<string, mixed> $data */
    public function create(array $data): ShippingRateVersion
    {
        return DB::transaction(function () use ($data): ShippingRateVersion {
            // Serialize version allocation on a stable row, including an empty tariff history.
            User::query()->where('role', UserRole::Admin)->orderBy('id')->lockForUpdate()->firstOrFail();
            $previous = ShippingRateVersion::query()->latest('version_number')->first();
            $regions = collect($data['region_surcharges']);
            unset($data['region_surcharges']);
            $rate = ShippingRateVersion::create([
                ...$data,
                'base_fee_cents' => 0,
                'included_weight_grams' => 1,
                'additional_weight_grams' => 1,
                'additional_fee_cents' => 0,
                'destination_surcharge_cents' => 0,
                // Technical measurement policy is read-only in the Admin shipping API.
                'volumetric_divisor' => $previous?->volumetric_divisor ?? 5000,
                'max_weight_grams' => $previous?->max_weight_grams ?? 100000,
                'max_length_mm' => $previous?->max_length_mm ?? 2000,
                'max_width_mm' => $previous?->max_width_mm ?? 2000,
                'max_height_mm' => $previous?->max_height_mm ?? 2000,
                'version_number' => ($previous?->version_number ?? 0) + 1,
                'status' => 'draft',
                'currency' => $data['currency'] ?? 'PHP',
            ]);
            $rate->regionSurcharges()->createMany($regions->map(fn (array $item) => [
                'destination_region' => trim($item['region']),
                'normalized_region' => mb_strtolower(trim($item['region'])),
                'surcharge_cents' => $item['surcharge_cents'],
            ])->all());

            return $rate->load('regionSurcharges');
        });
    }
}
