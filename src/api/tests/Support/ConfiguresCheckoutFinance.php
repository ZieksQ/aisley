<?php

namespace Tests\Support;

use App\Enums\AddressType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Address;
use App\Models\CommissionPolicy;
use App\Models\HubServiceArea;
use App\Models\LogisticsOrganization;
use App\Models\LogisticsRateCard;
use App\Models\LogisticsShippingRateAcceptance;
use App\Models\Product;
use App\Models\ShippingRateVersion;
use App\Models\Shop;
use App\Models\ShopLogisticsProvider;
use App\Models\SortingLane;
use App\Models\SortingPlan;
use App\Models\SortingPlanVersion;
use App\Models\User;

trait ConfiguresCheckoutFinance
{
    protected function configureTestCheckoutFinance(bool $completeRoute = true): void
    {
        Product::query()->update(['shipping_weight_grams' => 500, 'shipping_length_mm' => 200, 'shipping_width_mm' => 150, 'shipping_height_mm' => 100]);
        foreach (Shop::query()->with('seller')->get() as $shop) {
            $this->pickupAddress($shop->seller, $shop->name);
        }
        $logisticsUser = User::factory()->create(['role' => UserRole::Logistics, 'status' => UserStatus::Active]);
        $hubAddress = $this->pickupAddress($logisticsUser, 'Test Logistics');
        $organization = LogisticsOrganization::create(['user_id' => $logisticsUser->id, 'business_name' => 'Test Logistics']);
        $organization->hub()->create(['address_id' => $hubAddress->id, 'name' => 'Test Hub']);
        foreach (Shop::query()->get() as $shop) {
            ShopLogisticsProvider::create([
                'shop_id' => $shop->id,
                'logistics_organization_id' => $organization->id,
                'configured_by' => $shop->seller_id,
                'is_enabled' => true,
            ]);
        }
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
        if ($completeRoute) {
            $this->configureTestCheckoutRoute($organization);
        }
        foreach (['seller', 'logistics'] as $type) {
            CommissionPolicy::create([
                'beneficiary_type' => $type, 'rate_basis_points' => 0, 'status' => 'published',
                'effective_at' => now()->subDay(), 'revision' => 1,
            ]);
        }
    }

    protected function configureTestCheckoutRoute(LogisticsOrganization $organization): void
    {
        $hub = $organization->hub;
        $lane = SortingLane::create([
            'logistics_organization_id' => $organization->id, 'logistics_hub_id' => $hub->id,
            'created_by_logistics_id' => $organization->user_id, 'code' => 'CHECKOUT',
            'name' => 'Checkout delivery', 'type' => 'standard', 'is_active' => true, 'position' => 1,
        ]);
        $plan = SortingPlan::create([
            'logistics_organization_id' => $organization->id, 'logistics_hub_id' => $hub->id,
            'created_by_logistics_id' => $organization->user_id, 'name' => 'Checkout route', 'is_active' => true,
        ]);
        foreach (['1203', '1204'] as $postal) {
            HubServiceArea::create(['logistics_hub_id' => $hub->id, 'postal_code' => $postal,
                'is_active' => true, 'created_by' => $organization->user_id]);
            $plan->lanes()->create(['sorting_lane_id' => $lane->id, 'destination_type' => 'postal_code',
                'postal_code' => $postal, 'position' => 1]);
        }
        $version = SortingPlanVersion::create([
            'sorting_plan_id' => $plan->id, 'number' => 1, 'name' => $plan->name,
            'mappings' => $plan->lanes->map(fn ($mapping) => [
                ...$mapping->only(['id', 'sorting_lane_id', 'postal_code', 'destination_hub_id', 'position']),
                'destination_type' => $mapping->destination_type->value,
            ])->all(),
            'differences' => [], 'published_by' => $organization->user_id, 'published_at' => now(),
        ]);
        $plan->update(['active_version_id' => $version->id, 'draft_dirty' => false]);
        $card = LogisticsRateCard::create([
            'logistics_organization_id' => $organization->id, 'version_number' => 1, 'status' => 'published',
            'currency' => 'PHP', 'effective_at' => now()->subDay(), 'published_at' => now()->subDay(),
            'published_by' => $organization->user_id,
        ]);
        foreach (['first_mile', 'last_mile'] as $service) {
            $card->services()->create(['service_type' => $service, 'base_fee_cents' => 0]);
            foreach (Shop::query()->pluck('shop_category_id')->filter()->unique() as $categoryId) {
                $card->rules()->create([
                    'shop_category_id' => $categoryId, 'service_type' => $service, 'base_charge_cents' => 0,
                    'included_weight_grams' => 1000, 'additional_weight_grams' => 500, 'additional_fee_cents' => 0,
                    'max_weight_grams' => 100000, 'max_length_mm' => 2000, 'max_width_mm' => 2000, 'max_height_mm' => 2000,
                ]);
            }
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
