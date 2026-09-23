<?php

namespace Tests\Support;

use App\Enums\AddressType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Address;
use App\Models\CommissionPolicy;
use App\Models\LogisticsOrganization;
use App\Models\LogisticsShippingRateAcceptance;
use App\Models\Product;
use App\Models\ShippingRateVersion;
use App\Models\Shop;
use App\Models\User;

trait ConfiguresCheckoutFinance
{
    protected function configureTestCheckoutFinance(): void
    {
        Product::query()->update(['shipping_weight_grams' => 500, 'shipping_length_mm' => 200, 'shipping_width_mm' => 150, 'shipping_height_mm' => 100]);
        foreach (Shop::query()->with('seller')->get() as $shop) {
            $this->pickupAddress($shop->seller, $shop->name);
        }
        $logisticsUser = User::factory()->create(['role' => UserRole::Logistics, 'status' => UserStatus::Active]);
        $hubAddress = $this->pickupAddress($logisticsUser, 'Test Logistics');
        $organization = LogisticsOrganization::create(['user_id' => $logisticsUser->id, 'business_name' => 'Test Logistics']);
        $organization->hub()->create(['address_id' => $hubAddress->id, 'name' => 'Test Hub']);
        $rate = ShippingRateVersion::create([
            'version_number' => 1, 'status' => 'published', 'base_fee_cents' => 0,
            'included_weight_grams' => 1000, 'additional_weight_grams' => 500, 'additional_fee_cents' => 0,
            'volumetric_divisor' => 5000, 'max_weight_grams' => 100000, 'max_length_mm' => 2000,
            'max_width_mm' => 2000, 'max_height_mm' => 2000, 'destination_surcharge_cents' => 0,
            'currency' => 'PHP', 'effective_at' => now()->subDay(), 'published_at' => now()->subDay(), 'revision' => 1,
        ]);
        LogisticsShippingRateAcceptance::create([
            'shipping_rate_version_id' => $rate->id, 'logistics_organization_id' => $organization->id,
            'accepted_at' => now()->subDay(), 'accepted_by' => $logisticsUser->id,
        ]);
        foreach (['seller', 'logistics'] as $type) {
            CommissionPolicy::create([
                'beneficiary_type' => $type, 'rate_basis_points' => 0, 'status' => 'published',
                'effective_at' => now()->subDay(), 'revision' => 1,
            ]);
        }
    }

    protected function pickupAddress(User $user, string $name): Address
    {
        return Address::firstOrCreate(['user_id' => $user->id, 'label' => 'Checkout pickup'], [
            'type' => AddressType::Both, 'recipient_name' => $name, 'contact_number' => '09171234567',
            'address_line_1' => '1 Test Road', 'barangay' => 'San Antonio', 'city_municipality' => 'Makati City',
            'province' => 'Metro Manila', 'region' => 'NCR', 'postal_code' => '1203', 'country' => 'Philippines',
            'is_default' => true,
        ]);
    }
}
