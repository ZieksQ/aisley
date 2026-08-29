<?php

namespace Tests\Feature;

use App\Enums\ProductStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\ProductOptionGroup;
use App\Models\ProductVariant;
use App\Models\User;
use Database\Seeders\InitialCustomerSeeder;
use Database\Seeders\InitialSellerSeeder;
use Database\Seeders\ProductSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class DatabaseSeedersTest extends TestCase
{
    use RefreshDatabase;

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
        $this->seed(InitialSellerSeeder::class);
        $this->seed(ProductSeeder::class);

        $products = Product::query()->storefrontPurchasable()->get();
        $seller = User::query()
            ->where('email', 'catalog@aisley.test')
            ->where('role', UserRole::Seller)
            ->firstOrFail();

        $this->assertCount(4, $products);
        $this->assertTrue(Hash::check('Seller12345', $seller->password));
        $this->assertSame('Aisley Demo Store', $seller->shop->name);
        $this->assertTrue($products->every(
            fn (Product $product) => $product->status === ProductStatus::Active
                && str_starts_with($product->thumbnail_path, 'https://images.unsplash.com/')
                && $product->description_markdown !== null
                && $product->specifications !== null,
        ));

        $this->assertDatabaseCount('product_media', 12);
        $this->assertDatabaseCount('product_option_groups', 3);
        $this->assertDatabaseCount('product_option_values', 6);
        $this->assertDatabaseCount('product_variants', 6);
        $this->assertSame(12, ProductMedia::query()->where('path', 'like', 'https://images.unsplash.com/%')->count());
        $this->assertSame(3, ProductOptionGroup::query()->count());
        $this->assertSame(6, ProductVariant::query()->count());

        $this->seed(ProductSeeder::class);

        $this->assertDatabaseCount('products', 4);
        $this->assertDatabaseCount('product_media', 12);
        $this->assertDatabaseCount('product_option_groups', 3);
        $this->assertDatabaseCount('product_option_values', 6);
        $this->assertDatabaseCount('product_variants', 6);
    }

    public function test_initial_seller_seeder_creates_and_restores_the_shared_catalog_seller(): void
    {
        $this->seed(InitialSellerSeeder::class);

        $seller = User::query()
            ->where('email', 'catalog@aisley.test')
            ->where('role', UserRole::Seller)
            ->firstOrFail();

        $this->assertSame(UserStatus::Active, $seller->status);
        $this->assertTrue(Hash::check('Seller12345', $seller->password));
        $this->assertSame('Aisley', $seller->sellerProfile->first_name);
        $this->assertSame('Catalog', $seller->sellerProfile->last_name);

        $seller->forceFill([
            'password' => 'Changed12345',
            'status' => UserStatus::Suspended,
        ])->save();
        $seller->sellerProfile->update(['first_name' => 'Changed']);

        $this->seed(InitialSellerSeeder::class);

        $seller->refresh();
        $this->assertSame(UserStatus::Active, $seller->status);
        $this->assertTrue(Hash::check('Seller12345', $seller->password));
        $this->assertSame('Aisley', $seller->sellerProfile->fresh()->first_name);
        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('seller_profiles', 1);
    }

    public function test_shared_test_seller_is_not_seeded_in_production(): void
    {
        $originalEnvironment = app()->environment();
        app()->detectEnvironment(fn (): string => 'production');

        try {
            app(InitialSellerSeeder::class)->run();
        } finally {
            app()->detectEnvironment(fn (): string => $originalEnvironment);
        }

        $this->assertDatabaseMissing('users', [
            'email' => 'catalog@aisley.test',
            'role' => UserRole::Seller->value,
        ]);
    }
}
