<?php

namespace Tests\Feature\Finance;

use App\Enums\AddressType;
use App\Enums\CategoryStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Address;
use App\Models\AdminPermission;
use App\Models\Category;
use App\Models\LogisticsOrganization;
use App\Models\Permission;
use App\Models\Shop;
use App\Models\ShopCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ShippingRateConfigurationTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_creates_region_tariff_logistics_publishes_rules_and_seller_enables_provider(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $permission = Permission::create(['slug' => 'finance.manage', 'name' => 'Manage finance']);
        Permission::create(['slug' => 'finance.view', 'name' => 'View finance']);
        AdminPermission::create(['admin_id' => $admin->id, 'permission_id' => $permission->id]);
        Sanctum::actingAs($admin);

        $tariff = $this->postJson('/api/v1/admin/shipping-rates', [
            'base_fee_cents' => 4500,
            'volumetric_divisor' => 5000,
            'max_weight_grams' => 50000,
            'max_length_mm' => 2000,
            'max_width_mm' => 2000,
            'max_height_mm' => 2000,
            'effective_at' => now()->subMinute()->toISOString(),
            'region_surcharges' => [
                ['region' => 'NCR', 'surcharge_cents' => 1000],
                ['region' => 'Region IV-A', 'surcharge_cents' => 1500],
            ],
        ])->assertCreated()
            ->assertJsonPath('data.base_fee_cents', 4500)
            ->assertJsonCount(2, 'data.region_surcharges')
            ->json('data');
        $this->postJson('/api/v1/admin/shipping-rates/'.$tariff['id'].'/publish')
            ->assertOk()->assertJsonPath('data.status', 'published');

        [$logistics, $organization] = $this->logistics('Provider One');
        Sanctum::actingAs($logistics);
        $this->postJson('/api/v1/logistics/shipping-rates/'.$tariff['id'].'/accept')->assertOk();

        [$seller, $shop, $category] = $this->seller();
        Sanctum::actingAs($logistics);
        $card = $this->postJson('/api/v1/logistics/rate-cards', [
            'effective_at' => now()->subMinute()->toISOString(),
            'rules' => [[
                'category_id' => $category->id,
                'service_type' => 'first_mile',
                'base_charge_cents' => 1200,
                'included_weight_grams' => 1000,
                'additional_weight_grams' => 500,
                'additional_fee_cents' => 250,
                'max_weight_grams' => 50000,
                'max_length_mm' => 2000,
                'max_width_mm' => 2000,
                'max_height_mm' => 2000,
            ]],
        ])->assertCreated()->assertJsonPath('data.status', 'draft')->json('data');
        $this->postJson('/api/v1/logistics/rate-cards/'.$card['id'].'/publish')
            ->assertOk()->assertJsonPath('data.status', 'published');

        Sanctum::actingAs($seller);
        $this->getJson('/api/v1/seller/shipping-providers')
            ->assertOk()->assertJsonPath('data.0.is_enabled', false);
        $this->putJson('/api/v1/seller/shipping-providers/'.$organization->id, ['is_enabled' => true])
            ->assertOk()->assertJsonPath('data.is_enabled', true);
        $this->assertDatabaseHas('shop_logistics_providers', [
            'shop_id' => $shop->id,
            'logistics_organization_id' => $organization->id,
            'is_enabled' => true,
        ]);
    }

    /** @return array{User, LogisticsOrganization} */
    private function logistics(string $name): array
    {
        $user = User::factory()->create(['role' => UserRole::Logistics, 'status' => UserStatus::Active]);
        $address = $this->address($user, $name);
        $organization = LogisticsOrganization::create(['user_id' => $user->id, 'business_name' => $name]);
        $organization->hub()->create(['address_id' => $address->id, 'name' => $name.' Hub']);

        return [$user, $organization];
    }

    /** @return array{User, Shop, Category} */
    private function seller(): array
    {
        $user = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
        $shopCategory = ShopCategory::create(['name' => 'General', 'slug' => 'general', 'status' => CategoryStatus::Active]);
        $shop = Shop::create(['seller_id' => $user->id, 'shop_category_id' => $shopCategory->id, 'name' => 'Seller Shop', 'slug' => 'seller-shop', 'status' => ShopStatus::Active]);
        $category = Category::create(['shop_category_id' => $shopCategory->id, 'name' => 'Products', 'slug' => 'products', 'status' => CategoryStatus::Active]);
        $this->address($user, 'Seller Shop');

        return [$user, $shop, $category];
    }

    private function address(User $user, string $name): Address
    {
        return Address::create([
            'user_id' => $user->id,
            'type' => AddressType::Both,
            'label' => 'Primary',
            'recipient_name' => $name,
            'contact_number' => '09171234567',
            'address_line_1' => '1 Test Road',
            'barangay' => 'San Antonio',
            'city_municipality' => 'Makati City',
            'province' => 'Metro Manila',
            'region' => 'NCR',
            'postal_code' => '1203',
            'country' => 'Philippines',
            'is_default' => true,
        ]);
    }
}
