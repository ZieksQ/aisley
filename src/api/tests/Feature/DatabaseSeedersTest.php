<?php

namespace Tests\Feature;

use App\Enums\ProductStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Product;
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
                && str_starts_with($product->thumbnail_path, 'https://images.unsplash.com/'),
        ));

        $this->seed(ProductSeeder::class);

        $this->assertDatabaseCount('products', 4);
    }
}
