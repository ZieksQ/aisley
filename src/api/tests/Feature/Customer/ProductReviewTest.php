<?php

namespace Tests\Feature\Customer;

use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\ProductStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\CheckoutBatch;
use App\Models\CheckoutQuote;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\Shop;
use App\Models\User;
use Database\Seeders\ProductSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProductReviewTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_owning_customer_can_review_a_delivered_item_once_and_aggregates_are_authoritative(): void
    {
        $product = $this->product();
        $customer = $this->customer();
        $item = $this->order($customer, $product, OrderStatus::Delivered)->items()->firstOrFail();
        Sanctum::actingAs($customer);

        $first = $this->postJson("/api/v1/customer/order-items/{$item->id}/review", [
            'rating' => 5,
            'body' => "  Great fit\r\nfor daily use. ",
        ])->assertCreated()
            ->assertJsonPath('data.rating', 5)
            ->assertJsonPath('data.body', "Great fit\nfor daily use.")
            ->assertJsonPath('data.verifiedPurchase', true)
            ->assertJsonPath('data.authorLabel', 'Verified Customer')
            ->assertJsonMissingPath('data.customer_id');

        $reviewId = $first->json('data.id');
        $this->postJson("/api/v1/customer/order-items/{$item->id}/review", [
            'rating' => 5,
            'body' => "Great fit\nfor daily use.",
        ])->assertOk()->assertJsonPath('data.id', $reviewId);

        $this->postJson("/api/v1/customer/order-items/{$item->id}/review", [
            'rating' => 4,
            'body' => 'Changed after submission',
        ])->assertStatus(409)->assertJsonPath('code', 'PRODUCT_REVIEW_ALREADY_SUBMITTED');

        $this->assertDatabaseCount('product_reviews', 1);
        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'review_count' => 1,
            'average_rating' => '5.00',
        ]);

        $this->getJson("/api/v1/products/{$product->id}/reviews")
            ->assertOk()
            ->assertJsonPath('summary.reviewCount', 1)
            ->assertJsonPath('summary.averageRating', 5)
            ->assertJsonPath('data.0.id', $reviewId)
            ->assertJsonMissingPath('data.0.order_id');

        $this->getJson("/api/v1/customer/orders/{$item->order_id}")
            ->assertOk()
            ->assertJsonPath('data.items.0.canReview', false)
            ->assertJsonPath('data.items.0.reviewId', $reviewId);
    }

    public function test_review_requires_a_delivered_owned_item_and_hidden_products_are_not_public(): void
    {
        $product = $this->product();
        $customer = $this->customer();
        $otherCustomer = $this->customer();
        $placedItem = $this->order($customer, $product, OrderStatus::Placed)->items()->firstOrFail();
        $foreignItem = $this->order($otherCustomer, $product, OrderStatus::Delivered)->items()->firstOrFail();

        Sanctum::actingAs($customer);
        $this->postJson("/api/v1/customer/order-items/{$placedItem->id}/review", [
            'rating' => 5,
            'body' => 'Too early',
        ])->assertStatus(409)->assertJsonPath('code', 'PRODUCT_REVIEW_NOT_ELIGIBLE');
        $this->postJson("/api/v1/customer/order-items/{$foreignItem->id}/review", [
            'rating' => 5,
            'body' => 'Not mine',
        ])->assertNotFound();

        ProductReview::query()->create([
            'customer_id' => $otherCustomer->id,
            'order_id' => $foreignItem->order_id,
            'order_item_id' => $foreignItem->id,
            'product_id' => $product->id,
            'product_name_snapshot' => $product->name,
            'rating' => 4,
            'body' => 'Historical review',
            'status' => ProductReview::STATUS_PUBLISHED,
            'published_at' => now(),
        ]);
        $product->update(['status' => ProductStatus::Archived]);

        $this->getJson("/api/v1/products/{$product->id}/reviews")->assertNotFound();
    }

    public function test_validation_rejects_markup_and_unknown_review_fields(): void
    {
        $product = $this->product();
        $customer = $this->customer();
        $item = $this->order($customer, $product, OrderStatus::Delivered)->items()->firstOrFail();
        Sanctum::actingAs($customer);

        $this->postJson("/api/v1/customer/order-items/{$item->id}/review", [
            'rating' => 6,
            'body' => '<script>alert(1)</script>',
            'customer_id' => $customer->id,
        ])->assertStatus(422)->assertJsonValidationErrors(['rating', 'body', 'customer_id']);
    }

    private function product(): Product
    {
        $this->seed(ProductSeeder::class);

        return Product::query()->where('slug', 'compact-everyday-camera')->firstOrFail();
    }

    private function customer(): User
    {
        return User::factory()->create([
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ]);
    }

    private function order(User $customer, Product $product, OrderStatus $status): Order
    {
        $shop = Shop::query()->findOrFail($product->shop_id);
        $quote = CheckoutQuote::create([
            'customer_id' => $customer->id,
            'input_payload' => [],
            'request_hash' => hash('sha256', (string) Str::uuid()),
            'state_hash' => hash('sha256', (string) Str::uuid()),
            'expires_at' => now()->addHour(),
        ]);
        $batch = CheckoutBatch::create([
            'customer_id' => $customer->id,
            'checkout_quote_id' => $quote->id,
            'idempotency_key' => (string) Str::uuid(),
            'request_hash' => hash('sha256', (string) Str::uuid()),
            'currency' => 'PHP',
            'placed_at' => now()->subDay(),
        ]);
        $order = Order::create([
            'checkout_batch_id' => $batch->id,
            'customer_id' => $customer->id,
            'shop_id' => $shop->id,
            'reference' => 'ASL-REVIEW-'.Str::upper(Str::random(10)),
            'status' => $status,
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
        $order->items()->create([
            'product_id' => $product->id,
            'product_name' => $product->name,
            'variant_name' => null,
            'sku' => $product->base_sku,
            'selected_options' => [],
            'unit_price' => '15.00',
            'quantity' => 1,
            'line_subtotal' => '15.00',
            'currency' => 'PHP',
        ]);
        $order->address()->create([
            'recipient_name' => 'Review Customer',
            'contact_number' => '09171234567',
            'address_line_1' => '123 Test Street',
            'barangay' => 'San Antonio',
            'city_municipality' => 'Makati City',
            'province' => 'Metro Manila',
            'region' => 'NCR',
            'postal_code' => '1203',
            'country' => 'Philippines',
        ]);

        return $order;
    }
}
