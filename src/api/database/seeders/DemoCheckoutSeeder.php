<?php

namespace Database\Seeders;

use App\Enums\AddressType;
use App\Enums\CategoryStatus;
use App\Enums\Logistics\SortingDestinationType;
use App\Enums\Logistics\SortingLaneType;
use App\Enums\LogisticsRateCardStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Address;
use App\Models\CommissionPolicy;
use App\Models\HubServiceArea;
use App\Models\LogisticsOrganization;
use App\Models\LogisticsRateCard;
use App\Models\LogisticsRateRule;
use App\Models\LogisticsServiceRate;
use App\Models\LogisticsShippingRateAcceptance;
use App\Models\ShippingRateVersion;
use App\Models\Shop;
use App\Models\ShopLogisticsProvider;
use App\Models\SortingLane;
use App\Models\SortingPlan;
use App\Models\SortingPlanLane;
use App\Models\SortingPlanVersion;
use App\Models\User;
use App\Services\Logistics\SortingPlanService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/** Supplies the configured demo Shop with safe local checkout prerequisites. */
class DemoCheckoutSeeder extends Seeder
{
    private const SERVICE_BASE_FEES_CENTS = [
        'first_mile' => 3000,
        'last_mile' => 4000,
    ];

    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command?->warn('Demo checkout settings were not seeded in production.');

            return;
        }

        [$admin, $shop, $organization] = $this->configuredRecords();
        if ($admin === null || $shop === null || $organization === null) {
            return;
        }

        DB::transaction(function () use ($admin, $shop, $organization): void {
            [$rate, $created] = $this->platformRate($admin);
            if ($rate === null) {
                return;
            }

            $this->commissionPolicies($admin);
            $this->acceptNewPlatformRate($rate, $organization, $created);
            $this->rateCard($organization, $shop, $rate);
            $this->provider($shop, $organization);
            $this->localCoverage($organization);
            $this->customerAddress($organization);
        });
    }

    /** @return array{?User, ?Shop, ?LogisticsOrganization} */
    private function configuredRecords(): array
    {
        $adminEmail = $this->email(config('admin.initial.email'));
        $configuredSellerEmail = $this->email(config('seller.initial.email'));
        $hasConfiguredSeller = $configuredSellerEmail !== ''
            && is_string(config('seller.initial.password'))
            && config('seller.initial.password') !== '';
        $sellerEmail = $hasConfiguredSeller ? $configuredSellerEmail : 'catalog@aisley.test';
        $logisticsEmail = $this->email(config('logistics.initial.email'));

        $admin = $adminEmail === '' ? null : User::query()
            ->where('email', $adminEmail)->where('role', UserRole::Admin)
            ->where('status', UserStatus::Active)->first();
        $shop = Shop::query()->where('slug', 'aisley-demo-store')->first();
        $organization = $logisticsEmail === '' ? null : LogisticsOrganization::query()
            ->whereHas('user', fn ($query) => $query
                ->where('email', $logisticsEmail)
                ->where('role', UserRole::Logistics)
                ->where('status', UserStatus::Active))
            ->with(['user', 'hub.address'])->first();

        if ($admin === null) {
            $this->command?->warn('Demo checkout settings were not seeded: the configured active initial Admin is unavailable.');
        }
        if ($shop === null || $shop->seller_id !== User::query()
            ->where('email', $sellerEmail)->where('role', UserRole::Seller)->value('id')) {
            $this->command?->warn('Demo checkout settings were not seeded: the configured Seller does not own Aisley Demo Store.');
            $shop = null;
        } elseif ($shop->seller === null || $shop->shopCategory === null
            || $shop->status !== ShopStatus::Active
            || $shop->seller->status !== UserStatus::Active
            || $shop->shopCategory->status !== CategoryStatus::Active) {
            $this->command?->warn('Demo checkout settings were not seeded: the demo Seller, Shop, and main Shop Category must be active.');
            $shop = null;
        } elseif (! $this->hasDefaultPickupAddress($shop->seller)) {
            $this->command?->warn('Demo checkout settings need a complete default shipping address for the Shop pickup; existing Seller addresses were preserved.');
            $shop = null;
        }
        if ($organization?->hub?->address === null) {
            $this->command?->warn('Demo checkout settings were not seeded: the configured active initial Logistics organization needs a hub address.');
            $organization = null;
        }

        return [$admin, $shop, $organization];
    }

    /** @return array{?ShippingRateVersion, bool} */
    private function platformRate(User $admin): array
    {
        $active = ShippingRateVersion::query()->where('status', 'published')
            ->whereNotNull('published_at')->where('effective_at', '<=', now())
            ->orderByDesc('effective_at')->orderByDesc('version_number')->first();
        if ($active !== null) {
            return [$active, false];
        }

        if (ShippingRateVersion::query()->exists()) {
            $this->command?->warn('Demo checkout settings need a current platform tariff; existing tariff history was preserved.');

            return [null, false];
        }

        $now = now();

        return [ShippingRateVersion::query()->create([
            'version_number' => 1,
            'status' => 'published',
            'currency' => 'PHP',
            'base_fee_cents' => 0,
            'included_weight_grams' => 1,
            'additional_weight_grams' => 1,
            'additional_fee_cents' => 0,
            'volumetric_divisor' => 5000,
            'max_weight_grams' => 100000,
            'max_length_mm' => 2000,
            'max_width_mm' => 2000,
            'max_height_mm' => 2000,
            'destination_surcharge_cents' => 0,
            'effective_at' => $now,
            'published_at' => $now,
            'published_by_admin_id' => $admin->id,
            'revision' => 1,
        ]), true];
    }

    private function commissionPolicies(User $admin): void
    {
        foreach (['seller', 'logistics'] as $beneficiary) {
            if (CommissionPolicy::query()->where('beneficiary_type', $beneficiary)->exists()) {
                $active = CommissionPolicy::query()->where('beneficiary_type', $beneficiary)
                    ->where('status', 'published')->where('effective_at', '<=', now())
                    ->where(fn ($query) => $query->whereNull('ends_at')->orWhere('ends_at', '>', now()))
                    ->exists();
                if (! $active) {
                    $this->command?->warn("No current {$beneficiary} commission policy exists; existing policy history was preserved.");
                }

                continue;
            }

            CommissionPolicy::query()->create([
                'beneficiary_type' => $beneficiary,
                'rate_basis_points' => 0,
                'status' => 'published',
                'effective_at' => now(),
                'ends_at' => null,
                'published_by_admin_id' => $admin->id,
                'revision' => 1,
            ]);
        }
    }

    private function acceptNewPlatformRate(ShippingRateVersion $rate, LogisticsOrganization $organization, bool $created): void
    {
        if (! $created) {
            $acceptance = LogisticsShippingRateAcceptance::query()
                ->where('shipping_rate_version_id', $rate->id)
                ->where('logistics_organization_id', $organization->id)
                ->whereNull('revoked_at')->exists();
            if (! $acceptance) {
                $this->command?->warn('The initial Logistics organization has not accepted the current platform tariff.');
            }

            return;
        }

        LogisticsShippingRateAcceptance::query()->firstOrCreate(
            [
                'shipping_rate_version_id' => $rate->id,
                'logistics_organization_id' => $organization->id,
            ],
            ['accepted_by' => $organization->user_id, 'accepted_at' => now()],
        );
    }

    private function rateCard(LogisticsOrganization $organization, Shop $shop, ShippingRateVersion $platformRate): void
    {
        if (LogisticsRateCard::query()->where('logistics_organization_id', $organization->id)->exists()) {
            $current = LogisticsRateCard::query()->where('logistics_organization_id', $organization->id)
                ->where('status', LogisticsRateCardStatus::Published)
                ->where('effective_at', '<=', now())->orderByDesc('effective_at')->orderByDesc('version_number')
                ->with(['services', 'rules'])->first();
            if (! $this->hasShopRates($current, $shop)) {
                $this->command?->warn('Demo checkout settings need first-mile and last-mile rates for the Shop main category; existing rate-card history was preserved.');
            }

            return;
        }

        $card = LogisticsRateCard::query()->create([
            'logistics_organization_id' => $organization->id,
            'version_number' => 1,
            'status' => LogisticsRateCardStatus::Published,
            'currency' => 'PHP',
            'effective_at' => now(),
            'published_at' => now(),
            'published_by' => $organization->user_id,
            'revision' => 1,
        ]);

        foreach (self::SERVICE_BASE_FEES_CENTS as $service => $fee) {
            LogisticsServiceRate::query()->create([
                'logistics_rate_card_id' => $card->id,
                'service_type' => $service,
                'base_fee_cents' => $fee,
            ]);
            LogisticsRateRule::query()->create([
                'logistics_rate_card_id' => $card->id,
                'shop_category_id' => $shop->shop_category_id,
                'category_id' => null,
                'service_type' => $service,
                'base_charge_cents' => 0,
                'included_weight_grams' => 1000,
                'additional_weight_grams' => 500,
                'additional_fee_cents' => 500,
                'max_weight_grams' => $platformRate->max_weight_grams,
                'max_length_mm' => $platformRate->max_length_mm,
                'max_width_mm' => $platformRate->max_width_mm,
                'max_height_mm' => $platformRate->max_height_mm,
            ]);
        }
    }

    private function hasShopRates(?LogisticsRateCard $card, Shop $shop): bool
    {
        if ($card === null) {
            return false;
        }

        foreach (array_keys(self::SERVICE_BASE_FEES_CENTS) as $service) {
            if (! $card->services->contains(fn ($rate) => $rate->service_type->value === $service)
                || ! $card->rules->contains(fn ($rule) => $rule->service_type->value === $service
                    && $rule->shop_category_id === $shop->shop_category_id)) {
                return false;
            }
        }

        return true;
    }

    private function provider(Shop $shop, LogisticsOrganization $organization): void
    {
        $provider = ShopLogisticsProvider::query()->firstOrCreate(
            ['shop_id' => $shop->id, 'logistics_organization_id' => $organization->id],
            ['configured_by' => $shop->seller_id, 'is_enabled' => true],
        );

        if (! $provider->is_enabled) {
            $this->command?->warn('The demo Logistics provider is disabled in Seller settings; that choice was preserved.');
        }
    }

    private function localCoverage(LogisticsOrganization $organization): void
    {
        $hub = $organization->hub;
        $postalCode = app(SortingPlanService::class)->normalizePostalCode((string) $hub->address->postal_code);
        if ($postalCode === null) {
            $this->command?->warn('Local demo routing needs a four-digit postal code on the initial Logistics hub address.');

            return;
        }

        $activeArea = HubServiceArea::query()->where('postal_code', $postalCode)->where('is_active', true)->first();
        if ($activeArea === null) {
            $inactiveArea = HubServiceArea::query()->where('logistics_hub_id', $hub->id)->where('postal_code', $postalCode)->first();
            if ($inactiveArea !== null) {
                $this->command?->warn("Postal coverage {$postalCode} is inactive; its state was preserved.");

                return;
            }

            HubServiceArea::query()->create([
                'logistics_hub_id' => $hub->id,
                'postal_code' => $postalCode,
                'is_active' => true,
                'revision' => 1,
                'created_by' => $organization->user_id,
            ]);
        } elseif ($activeArea->logistics_hub_id !== $hub->id) {
            $this->command?->warn("Postal coverage {$postalCode} is assigned to another hub; its owner was preserved.");

            return;
        }

        $activePlans = SortingPlan::query()->where('logistics_hub_id', $hub->id)->where('is_active', true)
            ->get()->map(fn ($plan) => app(SortingPlanService::class)->plansForHub($organization->id, $hub->id))->filter();
        if ($activePlans->isNotEmpty()) {
            $configured = $activePlans->contains(fn (SortingPlan $plan) => $plan->lanes->contains(
                fn (SortingPlanLane $lane) => $lane->destination_type === SortingDestinationType::PostalCode
                    && $lane->postal_code === $postalCode
                    && $lane->lane?->is_active
                    && $lane->lane?->type === SortingLaneType::Standard,
            ));
            if (! $configured) {
                $this->command?->warn('An active Logistics sorting plan needs a standard postal lane for local demo delivery; the existing plan was preserved.');
            }

            return;
        }

        if (SortingPlan::query()->where('logistics_hub_id', $hub->id)->where('name', 'Aisley Local Demo')->exists()) {
            $this->command?->warn('The Aisley Local Demo sorting plan exists but is inactive; its state was preserved.');

            return;
        }

        $lane = SortingLane::query()->firstOrCreate(
            [
                'logistics_organization_id' => $organization->id,
                'logistics_hub_id' => $hub->id,
                'code' => 'LOCAL',
            ],
            [
                'created_by_logistics_id' => $organization->user_id,
                'name' => 'Local Delivery',
                'type' => SortingLaneType::Standard,
                'is_active' => true,
                'position' => 1,
                'revision' => 1,
            ],
        );
        if (! $lane->is_active || $lane->type !== SortingLaneType::Standard) {
            $this->command?->warn('The LOCAL sorting lane is inactive or non-standard; its state was preserved.');

            return;
        }

        $plan = SortingPlan::query()->create([
            'logistics_organization_id' => $organization->id,
            'logistics_hub_id' => $hub->id,
            'created_by_logistics_id' => $organization->user_id,
            'name' => 'Aisley Local Demo',
            'is_active' => true,
            'revision' => 1,
        ]);
        $mapping = $plan->lanes()->create([
            'sorting_lane_id' => $lane->id,
            'destination_type' => SortingDestinationType::PostalCode,
            'postal_code' => $postalCode,
            'position' => 1,
        ]);
        SortingLane::query()->firstOrCreate(['logistics_organization_id' => $organization->id, 'logistics_hub_id' => $hub->id, 'code' => 'EXCEPTION'],
            ['created_by_logistics_id' => $organization->user_id, 'name' => 'Exception review', 'type' => SortingLaneType::Exception, 'is_active' => true, 'position' => 2, 'revision' => 1]);
        $version = SortingPlanVersion::create(['sorting_plan_id' => $plan->id, 'number' => 1, 'name' => $plan->name,
            'mappings' => [[...$mapping->only(['id', 'sorting_lane_id', 'postal_code', 'destination_hub_id', 'position']), 'destination_type' => $mapping->destination_type->value]],
            'differences' => ['initial' => true], 'published_by' => $organization->user_id, 'published_at' => now()]);
        $plan->update(['active_version_id' => $version->id, 'draft_dirty' => false]);

    }

    private function customerAddress(LogisticsOrganization $organization): void
    {
        $customerEmail = $this->email(config('customer.initial.email'));
        if ($customerEmail === '') {
            $this->command?->warn('The configured initial Customer is unavailable; no demo delivery address was created.');

            return;
        }

        $customer = User::query()->where('email', $customerEmail)
            ->where('role', UserRole::Customer)->where('status', UserStatus::Active)->first();
        if ($customer === null) {
            $this->command?->warn('The configured active initial Customer is unavailable; no demo delivery address was created.');

            return;
        }

        $hasShippingAddress = $customer->addresses()->whereIn('type', [AddressType::Shipping->value, AddressType::Both->value])
            ->whereNotNull('address_line_1')->whereNotNull('barangay')->whereNotNull('city_municipality')
            ->whereNotNull('province')->whereNotNull('region')->whereNotNull('postal_code')
            ->whereNotNull('recipient_name')->whereNotNull('contact_number')->exists();
        if ($hasShippingAddress) {
            $matchingAddress = $customer->addresses()
                ->whereIn('type', [AddressType::Shipping->value, AddressType::Both->value])
                ->where('postal_code', $organization->hub->address->postal_code)
                ->exists();
            if (! $matchingAddress) {
                $this->command?->warn('The configured Customer has no address matching the local demo postal code; existing addresses were preserved.');
            }

            return;
        }
        if ($customer->addresses()->exists()) {
            $this->command?->warn('The configured Customer has addresses but no complete shipping address; they were preserved.');

            return;
        }

        $profile = $customer->customerProfile;
        $hubAddress = $organization->hub->address;
        Address::query()->create([
            'user_id' => $customer->id,
            'type' => AddressType::Shipping,
            'label' => 'Demo delivery address',
            'recipient_name' => trim(($profile?->first_name ?? 'Aisley').' '.($profile?->last_name ?? 'Customer')),
            'contact_number' => $profile?->contact_number ?? '+639171234567',
            'address_line_1' => '1 Demo Street',
            'barangay' => $hubAddress->barangay,
            'city_municipality' => $hubAddress->city_municipality,
            'province' => $hubAddress->province,
            'region' => $hubAddress->region,
            'postal_code' => $hubAddress->postal_code,
            'country' => 'Philippines',
            'is_default' => true,
        ]);
    }

    private function email(mixed $value): string
    {
        return is_string($value) ? strtolower(trim($value)) : '';
    }

    private function hasDefaultPickupAddress(User $seller): bool
    {
        return $seller->addresses()->where('is_default', true)
            ->whereIn('type', [AddressType::Shipping->value, AddressType::Both->value])
            ->whereNotNull('address_line_1')->whereNotNull('barangay')->whereNotNull('city_municipality')
            ->whereNotNull('province')->whereNotNull('region')->whereNotNull('postal_code')
            ->whereNotNull('recipient_name')->whereNotNull('contact_number')->exists();
    }
}
