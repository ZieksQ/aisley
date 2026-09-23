<?php

namespace Tests\Feature\Seller;

use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\ProductStatus;
use App\Enums\ProductVariantStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\CheckoutBatch;
use App\Models\CheckoutQuote;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\ProductVariant;
use App\Models\SellerReviewResponse;
use App\Models\Shop;
use App\Models\User;
use App\Services\Seller\ProductReviewService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use RuntimeException;
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
            ->assertJsonPath('sections.reviews.state', 'unavailable')
            ->assertJsonPath('sections.reviews.reason', 'SHOP_SETUP_REQUIRED')
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

        $this->actingAs($seller)
            ->getJson('/api/v1/seller/dashboard?from=2026-08-01')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('to');

        $this->actingAs($seller)
            ->getJson('/api/v1/seller/dashboard?from=2026-08-01&to=2026-08-02&timezone=Not%2FAZone')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('timezone');
    }

    public function test_review_summary_reconciles_with_shop_queue_and_local_date_cohort(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-09-23T12:00:00Z'));
        $seller = $this->seller();
        $shop = $this->shop($seller, 'Review Shop', 'review-shop');
        $activeProduct = $this->product($shop, ProductStatus::Active, 2, 'Active review product');
        $archivedProduct = $this->product($shop, ProductStatus::Archived, 2, 'Archived review product');
        $deletedProduct = $this->product($shop, ProductStatus::Draft, 2, 'Deleted review product');

        $this->review($activeProduct, '2026-09-01T15:59:59Z');
        $inPeriod = $this->review($activeProduct, '2026-09-01T16:00:00Z');
        $archived = $this->review($archivedProduct, '2026-09-02T15:59:59Z');
        $deleted = $this->review($deletedProduct, '2026-09-02T12:00:00Z');
        $this->review($activeProduct, '2026-09-02T16:00:00Z');
        $this->respond($inPeriod);
        $this->respond($deleted);
        $deletedProduct->delete();

        $this->review($activeProduct, '2026-09-02T10:00:00Z', 'draft');
        $this->review($activeProduct, '2026-09-24T10:00:00Z');
        $foreignSeller = $this->seller();
        $foreignShop = $this->shop($foreignSeller, 'Other Reviews', 'other-reviews');
        $foreignProduct = $this->product($foreignShop, ProductStatus::Active, 1, 'Foreign review product');
        $foreignReview = $this->review($foreignProduct, '2026-09-02T12:00:00Z');

        $allTime = $this->actingAs($seller)
            ->getJson('/api/v1/seller/dashboard')
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('sections.reviews.state', 'available')
            ->assertJsonPath('sections.reviews.cohort', 'published_at')
            ->assertJsonPath('sections.reviews.metrics.total', 5)
            ->assertJsonPath('sections.reviews.metrics.answered', 2)
            ->assertJsonPath('sections.reviews.metrics.unanswered', 3)
            ->assertJsonPath('sections.orders.state', 'unavailable');

        $this->actingAs($seller)->getJson('/api/v1/seller/reviews?status=all')->assertJsonPath('meta.total', 5);
        $this->actingAs($seller)->getJson('/api/v1/seller/reviews?status=answered')->assertJsonPath('meta.total', 2);
        $this->actingAs($seller)->getJson('/api/v1/seller/reviews?status=unanswered')->assertJsonPath('meta.total', 3);

        $url = '/api/v1/seller/dashboard?from=2026-09-02&to=2026-09-02&timezone=Asia%2FManila';
        $period = $this->actingAs($seller)
            ->getJson($url)
            ->assertOk()
            ->assertJsonPath('period.from_utc', '2026-09-01T16:00:00+00:00')
            ->assertJsonPath('period.to_utc_exclusive', '2026-09-02T16:00:00+00:00')
            ->assertJsonPath('sections.reviews.metrics.total', 3)
            ->assertJsonPath('sections.reviews.metrics.answered', 2)
            ->assertJsonPath('sections.reviews.metrics.unanswered', 1);

        $privateDto = json_encode($period->json('sections.reviews'), JSON_THROW_ON_ERROR);
        foreach ([$foreignReview->id, $inPeriod->id, $inPeriod->customer_id, $activeProduct->id, $inPeriod->body] as $privateValue) {
            $this->assertStringNotContainsString($privateValue, $privateDto);
        }
        $this->assertSame(['state', 'metrics', 'cohort'], array_keys($period->json('sections.reviews')));
        $this->assertSame(5, $allTime->json('sections.reviews.metrics.total'));

        $this->respond($archived);
        $this->actingAs($seller)
            ->getJson($url)
            ->assertJsonPath('sections.reviews.metrics.total', 3)
            ->assertJsonPath('sections.reviews.metrics.answered', 3)
            ->assertJsonPath('sections.reviews.metrics.unanswered', 0);
    }

    public function test_review_summary_distinguishes_real_zero_from_source_failure(): void
    {
        $seller = $this->seller();
        $shop = $this->shop($seller, 'Quiet Shop', 'quiet-shop');
        $this->product($shop, ProductStatus::Active, 2, 'A stocked Product');

        $this->actingAs($seller)
            ->getJson('/api/v1/seller/dashboard')
            ->assertJsonPath('sections.reviews.state', 'empty')
            ->assertJsonPath('sections.reviews.metrics.total', 0)
            ->assertJsonPath('sections.reviews.metrics.answered', 0)
            ->assertJsonPath('sections.reviews.metrics.unanswered', 0);

        $this->mock(ProductReviewService::class)
            ->shouldReceive('publishedForShop')
            ->once()
            ->andThrow(new RuntimeException('Simulated review read failure'));

        $failed = $this->actingAs($seller)->getJson('/api/v1/seller/dashboard')
            ->assertOk()
            ->assertJsonPath('sections.catalog.metrics.total', 1)
            ->assertJsonPath('sections.reviews.state', 'error')
            ->assertJsonPath('sections.reviews.reason', 'REVIEW_SUMMARY_UNAVAILABLE');
        $failed->assertJsonMissingPath('sections.reviews.metrics');
    }

    private function review(Product $product, string $publishedAt, string $status = ProductReview::STATUS_PUBLISHED): ProductReview
    {
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $quote = CheckoutQuote::query()->create([
            'customer_id' => $customer->id,
            'input_payload' => [],
            'request_hash' => hash('sha256', (string) Str::uuid()),
            'state_hash' => hash('sha256', (string) Str::uuid()),
            'expires_at' => now()->addHour(),
        ]);
        $batch = CheckoutBatch::query()->create([
            'customer_id' => $customer->id,
            'checkout_quote_id' => $quote->id,
            'idempotency_key' => (string) Str::uuid(),
            'request_hash' => hash('sha256', (string) Str::uuid()),
            'currency' => 'PHP',
            'placed_at' => now()->subDay(),
        ]);
        $order = Order::query()->create([
            'checkout_batch_id' => $batch->id,
            'customer_id' => $customer->id,
            'shop_id' => $product->shop_id,
            'reference' => 'ASL-DASH-'.Str::upper(Str::random(12)),
            'status' => OrderStatus::Delivered,
            'payment_method' => PaymentMethod::CashOnDelivery,
            'payment_status' => PaymentStatus::Pending,
            'currency' => 'PHP',
            'merchandise_subtotal' => '15.00',
            'shipping_fee' => '5.00',
            'discount_total' => '0.00',
            'shipping_discount_total' => '0.00',
            'payable_total' => '20.00',
            'placed_at' => now()->subDay(),
        ]);
        $item = $order->items()->create([
            'product_id' => $product->id,
            'product_name' => $product->name,
            'selected_options' => [],
            'unit_price' => '15.00',
            'quantity' => 1,
            'line_subtotal' => '15.00',
            'currency' => 'PHP',
        ]);

        return ProductReview::query()->create([
            'customer_id' => $customer->id,
            'order_id' => $order->id,
            'order_item_id' => $item->id,
            'product_id' => $product->id,
            'product_name_snapshot' => $product->name,
            'rating' => 4,
            'body' => 'Private Customer review content',
            'status' => $status,
            'published_at' => CarbonImmutable::parse($publishedAt),
        ]);
    }

    private function respond(ProductReview $review): SellerReviewResponse
    {
        return SellerReviewResponse::query()->create([
            'review_id' => $review->id,
            'seller_id' => $review->product->shop->seller_id,
            'shop_id' => $review->product->shop_id,
            'shop_name_snapshot' => $review->product->shop->name,
            'body' => 'Shop response',
            'status' => 'published',
            'idempotency_key' => (string) Str::uuid(),
            'request_hash' => hash('sha256', (string) Str::uuid()),
            'published_at' => now(),
        ]);
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
