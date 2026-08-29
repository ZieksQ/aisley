<?php

namespace Tests\Feature\Seller;

use App\Enums\ProductStatus;
use App\Enums\ProductVariantStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SellerDashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_denies_guests_non_sellers_and_non_active_sellers(): void
    {
        $this->getJson('/api/v1/seller/dashboard')->assertUnauthorized();

        $customer = User::factory()->create([
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ]);
        $this->actingAs($customer)
            ->getJson('/api/v1/seller/dashboard')
            ->assertForbidden()
            ->assertJsonPath('code', 'FORBIDDEN_ROLE');

        foreach ([UserStatus::Pending, UserStatus::Rejected, UserStatus::Suspended, UserStatus::Deactivated] as $status) {
            $seller = User::factory()->create([
                'role' => UserRole::Seller,
                'status' => $status,
            ]);

            $this->actingAs($seller)
                ->getJson('/api/v1/seller/dashboard')
                ->assertForbidden();
        }
    }

    public function test_seller_without_a_shop_receives_setup_state_without_global_data(): void
    {
        $seller = $this->seller();
        $otherSeller = $this->seller();
        $otherShop = $this->shop($otherSeller, 'Other Store', 'other-store');
        $otherProduct = $this->product($otherShop, ProductStatus::Active, 4, 'Private product');

        $response = $this->actingAs($seller)
            ->getJson('/api/v1/seller/dashboard')
            ->assertOk()
            ->assertJsonPath('version', 1)
            ->assertJsonPath('code', 'SHOP_SETUP_REQUIRED')
            ->assertJsonPath('shop', null)
            ->assertJsonPath('sections.catalog.state', 'unavailable')
            ->assertJsonPath('sections.catalog.reason', 'SHOP_SETUP_REQUIRED')
            ->assertJsonPath('sections.orders.reason', 'DOMAIN_NOT_IMPLEMENTED')
            ->assertJsonCount(0, 'actions');

        $encoded = json_encode($response->json(), JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString($otherShop->id, $encoded);
        $this->assertStringNotContainsString($otherProduct->id, $encoded);
        $this->assertStringNotContainsString('Private product', $encoded);
    }

    public function test_dashboard_returns_only_the_authenticated_shops_catalog_counts(): void
    {
        $seller = $this->seller();
        $shop = $this->shop($seller, 'Aisley Goods', 'aisley-goods');

        $this->product($shop, ProductStatus::Active, 0, 'Zero stock product');
        $this->product($shop, ProductStatus::Draft, 3, 'Draft product');
        $this->product($shop, ProductStatus::Archived, 0, 'Archived product');
        $variantProduct = $this->product($shop, ProductStatus::Active, 0, 'Variant product');
        ProductVariant::create([
            'product_id' => $variantProduct->id,
            'sku' => 'OWN-ZERO',
            'stock_quantity' => 0,
            'status' => ProductVariantStatus::Active,
        ]);
        ProductVariant::create([
            'product_id' => $variantProduct->id,
            'sku' => 'OWN-IN-STOCK',
            'stock_quantity' => 5,
            'status' => ProductVariantStatus::Active,
        ]);

        $otherSeller = $this->seller();
        $otherShop = $this->shop($otherSeller, 'Other Store', 'other-store');
        $this->product($otherShop, ProductStatus::Active, 0, 'Other product');

        $this->actingAs($seller)
            ->getJson('/api/v1/seller/dashboard')
            ->assertOk()
            ->assertJsonPath('code', null)
            ->assertJsonPath('shop.id', $shop->id)
            ->assertJsonPath('shop.name', 'Aisley Goods')
            ->assertJsonPath('sections.catalog.state', 'available')
            ->assertJsonPath('sections.catalog.metrics.total', 4)
            ->assertJsonPath('sections.catalog.metrics.active', 2)
            ->assertJsonPath('sections.catalog.metrics.draft', 1)
            ->assertJsonPath('sections.catalog.metrics.archived', 1)
            ->assertJsonPath('sections.catalog.metrics.zero_stock_products', 1)
            ->assertJsonPath('sections.catalog.metrics.zero_stock_skus', 1)
            ->assertJsonPath('sections.catalog.stock_signal', 'catalog_quantity')
            ->assertJsonPath('sections.financial.state', 'unavailable')
            ->assertJsonPath('sections.financial.reason', 'DOMAIN_NOT_IMPLEMENTED')
            ->assertJsonStructure([
                'period' => ['from', 'to', 'timezone', 'from_utc', 'to_utc_exclusive'],
                'generated_at',
            ]);
    }

    public function test_dashboard_distinguishes_an_empty_catalog_from_an_unavailable_domain(): void
    {
        $seller = $this->seller();
        $this->shop($seller, 'Empty Shop', 'empty-shop');

        $this->actingAs($seller)
            ->getJson('/api/v1/seller/dashboard')
            ->assertOk()
            ->assertJsonPath('sections.catalog.state', 'empty')
            ->assertJsonPath('sections.catalog.metrics.total', 0)
            ->assertJsonPath('sections.catalog.metrics.zero_stock_products', 0)
            ->assertJsonPath('sections.orders.state', 'unavailable');
    }

    public function test_dashboard_validates_and_normalizes_optional_seller_local_periods(): void
    {
        $seller = $this->seller();
        $this->shop($seller, 'Period Shop', 'period-shop');

        $this->actingAs($seller)
            ->getJson('/api/v1/seller/dashboard?from=2026-08-03&to=2026-08-01&timezone=Asia%2FManila')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('to');

        $this->actingAs($seller)
            ->getJson('/api/v1/seller/dashboard?from=2026-08-01&to=2026-08-02&timezone=Asia%2FManila')
            ->assertOk()
            ->assertJsonPath('period.from', '2026-08-01')
            ->assertJsonPath('period.to', '2026-08-02')
            ->assertJsonPath('period.timezone', 'Asia/Manila')
            ->assertJsonPath('period.from_utc', '2026-07-31T16:00:00+00:00')
            ->assertJsonPath('period.to_utc_exclusive', '2026-08-02T16:00:00+00:00');
    }

    private function seller(): User
    {
        return User::factory()->create([
            'role' => UserRole::Seller,
            'status' => UserStatus::Active,
        ]);
    }

    private function shop(User $seller, string $name, string $slug): Shop
    {
        return Shop::create([
            'seller_id' => $seller->id,
            'name' => $name,
            'slug' => $slug,
            'status' => ShopStatus::Active,
        ]);
    }

    private function product(
        Shop $shop,
        ProductStatus $status,
        int $stock,
        string $name,
    ): Product {
        return Product::create([
            'shop_id' => $shop->id,
            'name' => $name,
            'slug' => str($name)->slug()->append('-', fake()->unique()->numberBetween(1, 999999)),
            'price' => '100.00',
            'stock_quantity' => $stock,
            'status' => $status,
        ]);
    }
}
