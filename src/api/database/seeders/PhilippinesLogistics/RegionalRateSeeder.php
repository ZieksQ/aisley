<?php

namespace Database\Seeders\PhilippinesLogistics;

use App\Enums\CategoryStatus;
use App\Enums\LogisticsRateCardStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\LogisticsOrganization;
use App\Models\LogisticsRateCard;
use App\Models\LogisticsRateRule;
use App\Models\LogisticsServiceRate;
use App\Models\LogisticsShippingRateAcceptance;
use App\Models\ShippingRateVersion;
use App\Models\ShopCategory;
use App\Models\User;

class RegionalRateSeeder
{
    public const BASE_FEES = ['first_mile' => 3500, 'linehaul' => 1500, 'last_mile' => 4500];

    public function seed(LogisticsOrganization $organization, callable $warn): void
    {
        $tariff = $this->tariff();
        if ($tariff !== null) {
            // An operator-revoked acceptance is never reapproved on rerun.
            LogisticsShippingRateAcceptance::firstOrCreate([
                'shipping_rate_version_id' => $tariff->id,
                'logistics_organization_id' => $organization->id,
            ], ['accepted_by' => $organization->user_id, 'accepted_at' => now()]);
        } else {
            $warn('Regional checkout requires an active platform tariff and Admin; existing tariff history was preserved.');
        }

        if (! LogisticsRateCard::where('logistics_organization_id', $organization->id)->exists()) {
            $card = LogisticsRateCard::create([
                'logistics_organization_id' => $organization->id, 'version_number' => 1,
                'status' => LogisticsRateCardStatus::Published, 'currency' => 'PHP',
                'effective_at' => now(), 'published_at' => now(),
                'published_by' => $organization->user_id, 'revision' => 1,
            ]);
            foreach (self::BASE_FEES as $service => $fee) {
                LogisticsServiceRate::create([
                    'logistics_rate_card_id' => $card->id, 'service_type' => $service, 'base_fee_cents' => $fee,
                ]);
                foreach (ShopCategory::where('status', CategoryStatus::Active)->get() as $category) {
                    LogisticsRateRule::create([
                        'logistics_rate_card_id' => $card->id, 'shop_category_id' => $category->id,
                        'category_id' => null, 'service_type' => $service, 'base_charge_cents' => 0,
                        'included_weight_grams' => 1000, 'additional_weight_grams' => 500,
                        'additional_fee_cents' => $service === 'linehaul' ? 250 : 500,
                        'max_weight_grams' => 20000,
                        'max_length_mm' => 1000, 'max_width_mm' => 1000, 'max_height_mm' => 1000,
                    ]);
                }
            }
        }

    }

    private function tariff(): ?ShippingRateVersion
    {
        $active = ShippingRateVersion::where('status', 'published')->whereNotNull('published_at')
            ->where('effective_at', '<=', now())->orderByDesc('effective_at')->orderByDesc('version_number')->first();
        if ($active !== null || ShippingRateVersion::query()->exists()) {
            return $active;
        }
        $admin = User::where('role', UserRole::Admin)->where('status', UserStatus::Active)->first();
        if ($admin === null) {
            return null;
        }

        return ShippingRateVersion::create([
            'version_number' => 1, 'status' => 'published', 'currency' => 'PHP',
            'base_fee_cents' => 0, 'included_weight_grams' => 1, 'additional_weight_grams' => 1,
            'additional_fee_cents' => 0, 'destination_surcharge_cents' => 0,
            'volumetric_divisor' => 5000, 'max_weight_grams' => 20000,
            'max_length_mm' => 1000, 'max_width_mm' => 1000, 'max_height_mm' => 1000,
            'effective_at' => now(), 'published_at' => now(),
            'published_by_admin_id' => $admin->id, 'revision' => 1,
        ]);
    }
}
