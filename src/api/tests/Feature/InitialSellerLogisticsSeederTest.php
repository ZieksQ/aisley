<?php

namespace Tests\Feature;

use App\Models\LogisticsOrganization;
use App\Models\Shop;
use App\Models\ShopLogisticsProvider;
use App\Models\User;
use Database\Seeders\InitialSellerLogisticsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InitialSellerLogisticsSeederTest extends TestCase
{
    use RefreshDatabase;

    private Shop $shop;

    private LogisticsOrganization $ncr;

    private LogisticsOrganization $other;

    protected function setUp(): void
    {
        parent::setUp();
        config(['seller.initial.email' => 'seller@example.com', 'seller.initial.password' => 'test-password']);
        $seller = User::factory()->create(['email' => 'seller@example.com', 'role' => 'seller', 'status' => 'active']);
        $this->shop = Shop::create(['seller_id' => $seller->id, 'slug' => 'aisley-demo-store', 'name' => 'Demo Store', 'status' => 'active']);
        $this->ncr = $this->organization('logistics.luzon01@example.com', 'National Capital Region (NCR)');
        $this->other = $this->organization('logistics.luzon02@example.com', 'Cordillera Administrative Region (CAR)');
    }

    private function organization(string $email, string $region): LogisticsOrganization
    {
        $user = User::factory()->create(['email' => $email, 'role' => 'logistics', 'status' => 'active']);
        $address = $user->addresses()->create(['type' => 'both', 'label' => 'Hub', 'recipient_name' => 'Test',
            'contact_number' => '+639171111111', 'address_line_1' => 'Hub Street', 'barangay' => 'Port Area',
            'city_municipality' => 'City of Manila', 'province' => 'Metro Manila', 'region' => $region,
            'postal_code' => '1018', 'country' => 'Philippines', 'is_default' => true]);
        $organization = $user->logisticsOrganization()->create(['business_name' => 'Test '.$region]);
        $organization->hub()->create(['name' => 'Test Hub', 'address_id' => $address->id]);

        return $organization;
    }

    public function test_only_ncr_is_enabled_and_existing_configuration_revisions_are_advanced_once(): void
    {
        $ncr = ShopLogisticsProvider::create(['shop_id' => $this->shop->id, 'logistics_organization_id' => $this->ncr->id,
            'configured_by' => $this->shop->seller_id, 'is_enabled' => false, 'revision' => 4]);
        $other = ShopLogisticsProvider::create(['shop_id' => $this->shop->id, 'logistics_organization_id' => $this->other->id,
            'configured_by' => $this->shop->seller_id, 'is_enabled' => true, 'revision' => 7]);
        $seller = User::factory()->create(['role' => 'seller', 'status' => 'active']);
        $foreign = Shop::create(['seller_id' => $seller->id, 'slug' => 'other-store', 'name' => 'Other Store', 'status' => 'active']);
        $foreignProvider = ShopLogisticsProvider::create(['shop_id' => $foreign->id, 'logistics_organization_id' => $this->other->id,
            'configured_by' => $seller->id, 'is_enabled' => true]);
        $this->seed(InitialSellerLogisticsSeeder::class);
        $this->assertTrue($ncr->fresh()->is_enabled);
        $this->assertSame(5, $ncr->fresh()->revision);
        $this->assertFalse($other->fresh()->is_enabled);
        $this->assertSame(8, $other->fresh()->revision);
        $this->assertTrue($foreignProvider->fresh()->is_enabled);
        $this->assertSame([$this->ncr->id], $this->shop->logisticsProviders()->where('is_enabled', true)->pluck('logistics_organization_id')->all());
        $this->seed(InitialSellerLogisticsSeeder::class);
        $this->assertSame(5, $ncr->fresh()->revision);
        $this->assertSame(8, $other->fresh()->revision);
        $this->assertDatabaseCount('shop_logistics_providers', 3);
    }

    public function test_an_unavailable_ncr_fixture_preserves_the_previous_selection(): void
    {
        $provider = ShopLogisticsProvider::create(['shop_id' => $this->shop->id, 'logistics_organization_id' => $this->other->id,
            'configured_by' => $this->shop->seller_id, 'is_enabled' => true]);
        $this->ncr->user->update(['status' => 'suspended']);
        $this->seed(InitialSellerLogisticsSeeder::class);
        $this->assertTrue($provider->fresh()->is_enabled);
        $this->assertDatabaseCount('shop_logistics_providers', 1);
    }

    public function test_a_foreign_shop_owner_is_not_reconfigured(): void
    {
        $this->shop->update(['seller_id' => User::factory()->create(['role' => 'seller', 'status' => 'active'])->id]);
        $this->seed(InitialSellerLogisticsSeeder::class);
        $this->assertDatabaseCount('shop_logistics_providers', 0);
    }

    public function test_initial_seller_logistics_are_not_reconfigured_in_production(): void
    {
        $environment = app()->environment();
        app()->detectEnvironment(fn () => 'production');
        try {
            app(InitialSellerLogisticsSeeder::class)->run();
        } finally {
            app()->detectEnvironment(fn () => $environment);
        }
        $this->assertDatabaseCount('shop_logistics_providers', 0);
    }
}
