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
            'effective_at' => now()->subMinute()->toISOString(),
            'region_surcharges' => [
                ['region' => 'NCR', 'surcharge_cents' => 1000],
                ['region' => 'Region IV-A', 'surcharge_cents' => 1500],
            ],
        ])->assertCreated()
            ->assertJsonMissingPath('data.base_fee_cents')
            ->assertJsonPath('data.volumetric_divisor', 5000)
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
            'services' => [['service_type' => 'first_mile', 'base_fee_cents' => 1200]],
            'rules' => [[
                'category_id' => $category->id,
                'service_type' => 'first_mile',
                'included_weight_grams' => 1000,
                'additional_weight_grams' => 500,
                'additional_fee_cents' => 250,
                'max_weight_grams' => 50000,
                'max_length_mm' => 2000,
                'max_width_mm' => 2000,
                'max_height_mm' => 2000,
            ]],
        ])->assertCreated()->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.services.0.base_fee_cents', 1200)
            ->assertJsonMissingPath('data.rules.0.base_charge_cents')->json('data');
        $this->postJson('/api/v1/logistics/rate-cards/'.$card['id'].'/publish')
            ->assertOk()->assertJsonPath('data.status', 'published');
        $this->getJson('/api/v1/logistics/rate-cards')
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.0.id', $card['id'])
            ->assertJsonPath('meta.categories.0.id', $category->id)
            ->assertJsonPath('meta.categories.0.name', 'Products')
            ->assertJsonPath('meta.categories.0.group_name', 'General');

        [$otherLogistics] = $this->logistics('Provider Two');
        Sanctum::actingAs($otherLogistics);
        $this->getJson('/api/v1/logistics/rate-cards')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/logistics/shipping-rates')
            ->assertOk()
            ->assertJsonPath('data.0.accepted', false);
        $this->postJson('/api/v1/logistics/rate-cards/'.$card['id'].'/publish')->assertNotFound();

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

    public function test_admin_can_change_only_surcharges_and_duplicate_regions_are_rejected(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $permission = Permission::create(['slug' => 'finance.manage', 'name' => 'Manage finance']);
        AdminPermission::create(['admin_id' => $admin->id, 'permission_id' => $permission->id]);
        Sanctum::actingAs($admin);
        $payload = ['effective_at' => now()->toISOString(), 'region_surcharges' => []];
        foreach (['base_fee_cents', 'volumetric_divisor', 'max_weight_grams', 'max_length_mm', 'max_width_mm', 'max_height_mm', 'additional_fee_cents', 'destination_surcharge_cents'] as $field) {
            $this->postJson('/api/v1/admin/shipping-rates', [...$payload, $field => 100])
                ->assertUnprocessable()->assertJsonValidationErrors($field);
        }
        $this->postJson('/api/v1/admin/shipping-rates', [...$payload, 'region_surcharges' => [
            ['region' => ' NCR ', 'surcharge_cents' => 100],
            ['region' => 'ncr', 'surcharge_cents' => 200],
        ]])->assertUnprocessable()->assertJsonValidationErrors('region_surcharges');
        $first = $this->postJson('/api/v1/admin/shipping-rates', $payload)->assertCreated()->json('data');
        $this->assertDatabaseHas('shipping_rate_versions', ['id' => $first['id'], 'base_fee_cents' => 0]);
        $this->postJson('/api/v1/admin/shipping-rates', $payload)->assertCreated()
            ->assertJsonPath('data.version_number', 2)->assertJsonPath('data.max_weight_grams', $first['max_weight_grams']);
        $this->assertDatabaseCount('shipping_rate_versions', 2);

        [$logistics] = $this->logistics('No Admin access');
        Sanctum::actingAs($logistics);
        $this->postJson('/api/v1/admin/shipping-rates', $payload)->assertForbidden();
    }

    public function test_service_base_fees_require_matching_category_rules_and_valid_unique_services(): void
    {
        [$logistics] = $this->logistics('Provider');
        [, , $category] = $this->seller();
        Sanctum::actingAs($logistics);
        $rule = [
            'category_id' => $category->id, 'service_type' => 'first_mile',
            'included_weight_grams' => 1000, 'additional_weight_grams' => 500, 'additional_fee_cents' => 250,
            'max_weight_grams' => 50000, 'max_length_mm' => 2000, 'max_width_mm' => 2000, 'max_height_mm' => 2000,
        ];
        $payload = ['effective_at' => now()->toISOString(), 'rules' => [$rule]];
        foreach ([
            [],
            [['service_type' => 'first_mile', 'base_fee_cents' => -1]],
            [['service_type' => 'unknown', 'base_fee_cents' => 100]],
            [['service_type' => 'last_mile', 'base_fee_cents' => 100]],
            [['service_type' => 'first_mile', 'base_fee_cents' => 100], ['service_type' => 'first_mile', 'base_fee_cents' => 200]],
            [['service_type' => 'first_mile', 'base_fee_cents' => 100], ['service_type' => 'linehaul', 'base_fee_cents' => 200]],
        ] as $services) {
            $this->postJson('/api/v1/logistics/rate-cards', [...$payload, 'services' => $services])->assertUnprocessable();
        }
        $services = [['service_type' => 'first_mile', 'base_fee_cents' => 0]];
        $this->postJson('/api/v1/logistics/rate-cards', [...$payload, 'services' => $services, 'rules' => [[...$rule, 'base_charge_cents' => 100]]])
            ->assertUnprocessable()->assertJsonValidationErrors('rules.0.base_charge_cents');
        $this->postJson('/api/v1/logistics/rate-cards', [...$payload, 'services' => $services, 'rules' => [$rule, $rule]])
            ->assertUnprocessable()->assertJsonValidationErrors('rules');
        $card = $this->postJson('/api/v1/logistics/rate-cards', [...$payload, 'services' => $services])->assertCreated()->json('data');
        $this->assertDatabaseCount('logistics_rate_cards', 1);
        $this->assertDatabaseHas('logistics_rate_rules', ['logistics_rate_card_id' => $card['id'], 'base_charge_cents' => 0]);
        $this->postJson('/api/v1/logistics/rate-cards/'.$card['id'].'/publish')->assertOk();
        $this->postJson('/api/v1/logistics/rate-cards/'.$card['id'].'/publish')->assertConflict();
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
