<?php

namespace Tests\Feature;

use App\Enums\ProductStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\InventorySku;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\ProductOptionGroup;
use App\Models\ProductVariant;
use App\Models\User;
use Database\Seeders\InitialCustomerSeeder;
use Database\Seeders\InitialLogisticsSeeder;
use Database\Seeders\InitialSellerSeeder;
use Database\Seeders\ProductSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class DatabaseSeedersTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('customer.generic.count', 0);
        config()->set('seller.generic.count', 0);
        config()->set('logistics.generic.count', 0);
    }

    public function test_initial_customer_seeder_creates_an_approved_customer_from_configuration(): void
    {
        config()->set('customer.initial', [
            'email' => 'customer@example.com',
            'password' => 'initial-secret',
            'first_name' => 'Jamie',
            'last_name' => 'Buyer',
            'contact_number' => '+639171111111',
            'birth_date' => '1998-04-12',
        ]);

        $this->seed(InitialCustomerSeeder::class);

        $customer = User::query()
            ->where('email', 'customer@example.com')
            ->where('role', UserRole::Customer)
            ->firstOrFail();

        $this->assertSame(UserStatus::Active, $customer->status);
        $this->assertTrue(Hash::check('initial-secret', $customer->password));
        $this->assertSame('Jamie', $customer->customerProfile->first_name);
        $this->assertSame('1998-04-12', $customer->customerProfile->birth_date->toDateString());

        config()->set('customer.initial.password', 'replacement-secret');
        $this->seed(InitialCustomerSeeder::class);

        $this->assertTrue(Hash::check('initial-secret', $customer->fresh()->password));
        $this->assertDatabaseCount('users', 1);
    }

    public function test_product_seeder_creates_storefront_visible_products_with_remote_thumbnails(): void
    {
        $this->configureInitialSeller();
        $this->seed(InitialSellerSeeder::class);
        $this->seed(ProductSeeder::class);

        $products = Product::query()->storefrontPurchasable()->get();
        $seller = User::query()
            ->where('email', 'seeded-seller@example.com')
            ->where('role', UserRole::Seller)
            ->firstOrFail();

        $this->assertCount(30, $products);
        $this->assertTrue(Hash::check('InitialSeller123', $seller->password));
        $this->assertSame('Aisley Demo Store', $seller->shop->name);
        $this->assertTrue($products->every(
            fn (Product $product) => $product->status === ProductStatus::Active
                && str_starts_with($product->thumbnail_path, 'https://images.unsplash.com/')
                && $product->description_markdown !== null
                && $product->specifications !== null
                && $product->base_sku !== null,
        ));

        $this->assertDatabaseCount('product_media', 38);
        $this->assertDatabaseCount('product_option_groups', 3);
        $this->assertDatabaseCount('product_option_values', 6);
        $this->assertDatabaseCount('product_variants', 6);
        $this->assertSame(38, ProductMedia::query()->where('path', 'like', 'https://images.unsplash.com/%')->count());
        $this->assertSame(3, ProductOptionGroup::query()->count());
        $this->assertSame(6, ProductVariant::query()->count());
        $this->assertSame(34, InventorySku::query()->count());
        $this->assertSame(0, InventorySku::query()->whereNull('shop_id')->count());

        $seller->update(['status' => UserStatus::Suspended]);
        $this->seed(ProductSeeder::class);

        $this->assertSame(UserStatus::Suspended, $seller->fresh()->status);
        $this->assertDatabaseCount('products', 30);
        $this->assertDatabaseCount('product_media', 38);
        $this->assertDatabaseCount('product_option_groups', 3);
        $this->assertDatabaseCount('product_option_values', 6);
        $this->assertDatabaseCount('product_variants', 6);
    }

    public function test_initial_seller_seeder_uses_configuration_without_overwriting_an_existing_account(): void
    {
        $this->configureInitialSeller([
            'email' => ' SEEDED-SELLER@example.com ',
        ]);
        $this->seed(InitialSellerSeeder::class);

        $seller = User::query()
            ->where('email', 'seeded-seller@example.com')
            ->where('role', UserRole::Seller)
            ->firstOrFail();

        $this->assertSame(UserStatus::Active, $seller->status);
        $this->assertTrue(Hash::check('InitialSeller123', $seller->password));
        $this->assertSame('Aisley', $seller->sellerProfile->first_name);
        $this->assertSame('Catalog', $seller->sellerProfile->last_name);
        $this->assertSame('Shop pickup address', $seller->addresses->sole()->label);
        $this->assertSame('Makati City', $seller->addresses->sole()->city_municipality);

        $seller->forceFill([
            'password' => 'Changed12345',
            'status' => UserStatus::Suspended,
        ])->save();
        $seller->sellerProfile->update(['first_name' => 'Changed']);
        $seller->addresses->sole()->update(['city_municipality' => 'Pasig City']);
        config()->set('seller.initial.password', 'ReplacementSeller456');
        config()->set('seller.initial.first_name', 'Replacement');

        $this->seed(InitialSellerSeeder::class);

        $seller->refresh();
        $this->assertSame(UserStatus::Suspended, $seller->status);
        $this->assertTrue(Hash::check('Changed12345', $seller->password));
        $this->assertSame('Changed', $seller->sellerProfile->fresh()->first_name);
        $this->assertSame('Pasig City', $seller->addresses()->sole()->city_municipality);
        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('seller_profiles', 1);
        $this->assertDatabaseCount('addresses', 1);
    }

    public function test_initial_seller_seeder_requires_explicit_credentials_in_production(): void
    {
        $originalEnvironment = app()->environment();
        app()->detectEnvironment(fn (): string => 'production');
        config()->set('seller.initial', [
            'email' => null,
            'password' => null,
            'first_name' => 'Aisley',
            'last_name' => 'Catalog',
            'contact_number' => '+639171234568',
            'birth_date' => '1995-01-01',
        ]);

        try {
            app(InitialSellerSeeder::class)->run();

            $this->assertDatabaseMissing('users', [
                'role' => UserRole::Seller->value,
            ]);

            $this->configureInitialSeller([
                'email' => 'production-seller@example.com',
                'password' => 'ProductionSeller123',
            ]);
            app(InitialSellerSeeder::class)->run();
        } finally {
            app()->detectEnvironment(fn (): string => $originalEnvironment);
        }

        $this->assertDatabaseHas('users', [
            'email' => 'production-seller@example.com',
            'role' => UserRole::Seller->value,
        ]);
    }

    public function test_initial_logistics_seeder_creates_one_active_organization_and_sole_hub_from_configuration(): void
    {
        config()->set('logistics.initial', [
            'email' => ' LOGISTICS@example.com ',
            'password' => 'InitialLogistics123',
            'first_name' => 'Logan',
            'last_name' => 'Operator',
            'contact_number' => '+639171111112',
            'birth_date' => '1990-01-01',
            'business_name' => 'Aisley Delivery Services',
            'hub_name' => 'Aisley Makati Hub',
            'address_line_1' => '1 Hub Road',
            'address_line_2' => null,
            'barangay' => 'Poblacion',
            'city_municipality' => 'Makati City',
            'province' => 'Metro Manila',
            'region' => 'National Capital Region (NCR)',
            'postal_code' => '1200',
        ]);

        $this->seed(InitialLogisticsSeeder::class);

        $logistics = User::query()
            ->where('email', 'logistics@example.com')
            ->where('role', UserRole::Logistics)
            ->firstOrFail();

        $this->assertSame(UserStatus::Active, $logistics->status);
        $this->assertTrue(Hash::check('InitialLogistics123', $logistics->password));
        $this->assertSame('Logan', $logistics->logisticsProfile->first_name);
        $this->assertSame('Aisley Delivery Services', $logistics->logisticsOrganization->business_name);
        $this->assertSame('Aisley Makati Hub', $logistics->logisticsOrganization->hub->name);

        config()->set('logistics.initial.password', 'ReplacementLogistics456');
        $this->seed(InitialLogisticsSeeder::class);

        $this->assertTrue(Hash::check('InitialLogistics123', $logistics->fresh()->password));
        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('logistics_hubs', 1);
    }

    public function test_generic_customer_seller_and_logistics_accounts_use_configured_role_passwords_and_are_idempotent(): void
    {
        config()->set('customer.initial', [
            'email' => 'customer@example.com',
            'password' => 'CustomerSecret123',
            'first_name' => 'Aisley',
            'last_name' => 'Customer',
            'contact_number' => '+639171234567',
            'birth_date' => '2000-01-01',
        ]);
        config()->set('customer.generic', [
            'count' => 20,
            'email_prefix' => 'customer',
            'email_domain' => 'seed.example.com',
        ]);
        config()->set('seller.initial', array_merge($this->sellerDetails(), [
            'email' => 'seller@example.com',
            'password' => 'SellerSecret123',
        ]));
        config()->set('seller.generic', [
            'count' => 5,
            'email_prefix' => 'seller',
            'email_domain' => 'seed.example.com',
        ]);
        config()->set('logistics.initial', [
            'email' => 'logistics@example.com',
            'password' => 'LogisticsSecret123',
            'first_name' => 'Aisley',
            'last_name' => 'Logistics',
            'contact_number' => '+639171234569',
            'birth_date' => '1990-01-01',
            'business_name' => 'Aisley Logistics',
            'hub_name' => 'Aisley Logistics Operational Hub',
            'address_line_1' => '1 Logistics Center',
            'address_line_2' => null,
            'barangay' => 'Poblacion',
            'city_municipality' => 'Makati City',
            'province' => 'Metro Manila',
            'region' => 'National Capital Region (NCR)',
            'postal_code' => '1200',
        ]);
        config()->set('logistics.generic', [
            'count' => 5,
            'email_prefix' => 'logistics',
            'email_domain' => 'seed.example.com',
        ]);

        $this->seed(InitialCustomerSeeder::class);
        $this->seed(InitialSellerSeeder::class);
        $this->seed(InitialLogisticsSeeder::class);

        $this->assertSame(21, User::query()->where('role', UserRole::Customer)->count());
        $this->assertSame(6, User::query()->where('role', UserRole::Seller)->count());
        $this->assertSame(6, User::query()->where('role', UserRole::Logistics)->count());
        $this->assertDatabaseCount('customer_profiles', 21);
        $this->assertDatabaseCount('seller_profiles', 6);
        $this->assertDatabaseCount('logistics_profiles', 6);
        $this->assertDatabaseCount('logistics_organizations', 6);
        $this->assertDatabaseCount('logistics_hubs', 6);

        $this->assertTrue(Hash::check('CustomerSecret123', User::query()->where('email', 'customer01@seed.example.com')->firstOrFail()->password));
        $this->assertTrue(Hash::check('SellerSecret123', User::query()->where('email', 'seller01@seed.example.com')->firstOrFail()->password));
        $this->assertTrue(Hash::check('LogisticsSecret123', User::query()->where('email', 'logistics01@seed.example.com')->firstOrFail()->password));

        $this->seed(InitialCustomerSeeder::class);
        $this->seed(InitialSellerSeeder::class);
        $this->seed(InitialLogisticsSeeder::class);

        $this->assertSame(21, User::query()->where('role', UserRole::Customer)->count());
        $this->assertSame(6, User::query()->where('role', UserRole::Seller)->count());
        $this->assertSame(6, User::query()->where('role', UserRole::Logistics)->count());
        $this->assertDatabaseCount('logistics_hubs', 6);
    }

    /** @param array<string, mixed> $overrides */
    private function configureInitialSeller(array $overrides = []): void
    {
        config()->set('seller.initial', array_merge($this->sellerDetails(), [
            'email' => 'seeded-seller@example.com',
            'password' => 'InitialSeller123',
        ], $overrides));
    }

    /** @return array<string, string|null> */
    private function sellerDetails(): array
    {
        return [
            'first_name' => 'Aisley',
            'last_name' => 'Catalog',
            'contact_number' => '+639171234568',
            'birth_date' => '1995-01-01',
            'address_line_1' => '1 Seller Street',
            'address_line_2' => null,
            'barangay' => 'Poblacion',
            'city_municipality' => 'Makati City',
            'province' => 'Metro Manila',
            'region' => 'National Capital Region (NCR)',
            'postal_code' => '1200',
        ];
    }
}
