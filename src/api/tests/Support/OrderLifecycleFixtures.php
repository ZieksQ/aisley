<?php

namespace Tests\Support;

use App\Enums\AddressType;
use App\Enums\CategoryStatus;
use App\Enums\ProductStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Category;
use App\Models\HubServiceArea;
use App\Models\InventoryBalance;
use App\Models\InventorySku;
use App\Models\LogisticsOrganization;
use App\Models\LogisticsRateCard;
use App\Models\LogisticsShippingRateAcceptance;
use App\Models\Product;
use App\Models\ShippingRateVersion;
use App\Models\User;
use Illuminate\Support\Str;

trait OrderLifecycleFixtures
{
    use ConfiguresCheckoutFinance, HubRoutingFixtures;

    /** Seed prerequisites only: Orders, waybills, custody and delivery are created through APIs. */
    private function lifecycleContext(bool $transfer): array
    {
        [$seller, $shop] = $this->sellerShop();
        $category = Category::create([
            'shop_category_id' => $shop->shop_category_id, 'name' => 'Lifecycle products',
            'slug' => 'lifecycle-products', 'status' => CategoryStatus::Active,
        ]);
        $product = Product::create([
            'shop_id' => $shop->id, 'category_id' => $category->id, 'name' => 'Lifecycle parcel',
            'slug' => 'lifecycle-parcel', 'base_sku' => 'LIFECYCLE', 'price' => '100.00',
            'currency' => 'PHP', 'stock_quantity' => 10, 'status' => ProductStatus::Active,
            'published_at' => now()->subMinute(),
        ]);
        $sku = InventorySku::create([
            'product_id' => $product->id, 'shop_id' => $shop->id,
            'code' => $product->base_sku, 'is_base' => true, 'status' => 'active',
        ]);
        $balance = InventoryBalance::create(['inventory_sku_id' => $sku->id, 'on_hand' => 10, 'reserved' => 0]);
        $this->configureTestCheckoutFinance();
        $organization = LogisticsOrganization::with('user', 'hub.address')->sole();
        $origin = [$organization->user, $organization, $organization->hub];
        $origin[2]->address->update(['latitude' => 14.60, 'longitude' => 120.98]);
        $destination = $transfer ? $this->pinnedHub() : $origin;
        $destination[2]->address->update(['latitude' => 14.65, 'longitude' => 121.03]);
        $firstCourier = $this->courier($origin[1]->id, $origin[2]->id);
        $finalCourier = $transfer ? $this->courier($destination[1]->id, $destination[2]->id) : $firstCourier;
        HubServiceArea::create([
            'logistics_hub_id' => $destination[2]->id, 'postal_code' => '6000',
            'is_active' => true, 'created_by' => $destination[0]->id,
        ]);
        if ($transfer) {
            $this->edge($origin[2], $destination[2]);
            $this->edge($destination[2], $origin[2]);
            LogisticsShippingRateAcceptance::create([
                'shipping_rate_version_id' => ShippingRateVersion::sole()->id,
                'logistics_organization_id' => $destination[1]->id,
                'accepted_at' => now()->subDay(), 'accepted_by' => $destination[0]->id,
            ]);
            $this->publishLifecyclePlan($origin[0], $destination[2]->id);
            $this->lifecycleRateCard($destination[1], $shop->shop_category_id);
        }
        $this->publishLifecyclePlan($destination[0]);
        $this->lifecycleRateCard($origin[1], $shop->shop_category_id);
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $address = $customer->addresses()->create([
            'type' => AddressType::Shipping, 'label' => 'Home', 'recipient_name' => 'Lifecycle Buyer',
            'contact_number' => '09174444444', 'address_line_1' => '9 Buyer Street', 'barangay' => 'Lahug',
            'city_municipality' => 'Cebu City', 'province' => 'Cebu', 'region' => 'Central Visayas',
            'postal_code' => '6000', 'country' => 'PH',
        ]);

        return compact('seller', 'shop', 'product', 'balance', 'origin', 'destination', 'firstCourier', 'finalCourier', 'customer', 'address');
    }

    private function publishLifecyclePlan(User $actor, ?string $nextHub = null): void
    {
        $this->asLifecycleActor($actor);
        $lane = $this->postJson('/api/v1/logistics/sorting/lanes', [
            'code' => 'LANE-1', 'name' => 'Original staging', 'type' => 'standard',
        ])->assertCreated()->json('data');
        $this->postJson('/api/v1/logistics/sorting/lanes', [
            'code' => 'EX', 'name' => 'Exceptions', 'type' => 'exception',
        ])->assertCreated();
        $plan = $this->postJson('/api/v1/logistics/sorting/plans', ['name' => 'Lifecycle plan'])
            ->assertCreated()->json('data');
        $mapping = $nextHub === null ? ['postal_code' => '6000'] : ['destination_type' => 'hub', 'destination_hub_id' => $nextHub];
        $this->postJson('/api/v1/logistics/sorting/plans/'.$plan['id'].'/lanes', [
            'expected_revision' => $plan['revision'], 'lane_id' => $lane['id'], ...$mapping,
        ])->assertOk();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/logistics/sorting/plans/'.$plan['id'].'/actions/publish', [
                'expected_revision' => 2, 'activate' => true,
            ])->assertOk();
    }

    private function lifecycleRateCard(LogisticsOrganization $organization, string $categoryId): void
    {
        $card = LogisticsRateCard::create([
            'logistics_organization_id' => $organization->id, 'version_number' => 1,
            'status' => 'published', 'currency' => 'PHP', 'effective_at' => now()->subDay(),
            'published_at' => now()->subDay(), 'published_by' => $organization->user_id,
        ]);
        foreach (['first_mile' => 400, 'linehaul' => 700, 'last_mile' => 600] as $service => $fee) {
            $card->services()->create(['service_type' => $service, 'base_fee_cents' => $fee]);
            $card->rules()->create([
                'shop_category_id' => $categoryId, 'service_type' => $service,
                'base_charge_cents' => 0, 'included_weight_grams' => 2000,
                'additional_weight_grams' => 500, 'additional_fee_cents' => 0,
                'max_weight_grams' => 100000, 'max_length_mm' => 2000,
                'max_width_mm' => 2000, 'max_height_mm' => 2000,
            ]);
        }
    }

    private function asLifecycleActor(User $actor): void
    {
        $this->app['auth']->forgetGuards();
        $this->withHeader('Authorization', '');
        if ($actor->role === UserRole::Courier) {
            $this->withToken($actor->createToken('lifecycle-verification', ['courier'])->plainTextToken);
        } else {
            $this->actingAs($actor, 'web');
        }
    }
}
