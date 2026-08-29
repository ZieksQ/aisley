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
        $this->seed(ProductSeeder::class);

        $products = Product::query()->storefrontPurchasable()->get();

        $this->assertCount(4, $products);
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
}
