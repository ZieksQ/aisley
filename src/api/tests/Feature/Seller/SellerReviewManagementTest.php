<?php

namespace Tests\Feature\Seller;

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
use App\Models\ProductReviewImage;
use App\Models\SellerReviewResponse;
use App\Models\Shop;
use App\Models\User;
use Database\Seeders\ProductSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class SellerReviewManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_filter_and_open_privacy_safe_shop_reviews(): void
    {
        $product = $this->product();
        $seller = $product->shop->seller;
        $unanswered = $this->review($product, $this->customer(), 5, 'Excellent daily camera.');
        $answered = $this->review($product, $this->customer(), 3, 'Good, but the strap is short.');
        SellerReviewResponse::query()->create([
            'review_id' => $answered->id,
            'seller_id' => $seller->id,
            'shop_id' => $product->shop_id,
            'shop_name_snapshot' => $product->shop->name,
            'body' => 'Thank you for sharing this feedback.',
            'status' => 'published',
            'idempotency_key' => (string) Str::uuid(),
            'request_hash' => hash('sha256', 'answer'),
            'published_at' => now(),
        ]);

        $this->actingAs($seller)
            ->getJson("/api/v1/seller/reviews?status=unanswered&product={$product->id}&rating=5")
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $unanswered->id)
            ->assertJsonPath('data.0.authorLabel', 'Verified Customer')
            ->assertJsonPath('data.0.responseState', 'unanswered')
            ->assertJsonPath('data.0.product.name', $product->name)
            ->assertJsonPath('filters.products.0.id', $product->id)
            ->assertJsonMissingPath('data.0.customer_id')
            ->assertJsonMissingPath('data.0.order_id')
            ->assertJsonMissingPath('data.0.order_item_id');

        $this->actingAs($seller)
            ->getJson("/api/v1/seller/reviews/{$answered->id}")
            ->assertOk()
            ->assertJsonPath('data.responseState', 'answered')
            ->assertJsonPath('data.sellerResponse.body', 'Thank you for sharing this feedback.')
            ->assertJsonMissingPath('data.sellerResponse.seller_id')
            ->assertHeader('Cache-Control', 'no-store, private');
    }

    public function test_foreign_seller_and_customer_cannot_read_or_respond_to_a_review(): void
    {
        $product = $this->product();
        $review = $this->review($product, $this->customer(), 4, 'Solid purchase.');
        $foreignSeller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);

        $this->getJson('/api/v1/seller/reviews')->assertUnauthorized();
        $this->actingAs($foreignSeller)
            ->getJson("/api/v1/seller/reviews/{$review->id}")
            ->assertNotFound();
        $this->actingAs($foreignSeller)
            ->postJson("/api/v1/seller/reviews/{$review->id}/response", ['response' => 'Not my product.'], [
                'Idempotency-Key' => (string) Str::uuid(),
            ])->assertNotFound();
        $sameEmailCustomer = User::factory()->create([
            'email' => $product->shop->seller->email,
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ]);
        $this->actingAs($sameEmailCustomer)
            ->getJson('/api/v1/seller/reviews')
            ->assertForbidden();
    }

    public function test_response_is_immutable_idempotent_public_and_notifies_the_customer(): void
    {
        $product = $this->product();
        $customer = $this->customer();
        $review = $this->review($product, $customer, 4, 'Works well for travel.');
        $seller = $product->shop->seller;
        $product->forceFill(['average_rating' => '4.00', 'review_count' => 1])->save();
        $key = (string) Str::uuid();

        $this->actingAs($seller)
            ->postJson("/api/v1/seller/reviews/{$review->id}/response", [
                'response' => "  Thank you for choosing us.\r\nWe appreciate your review. ",
            ], ['Idempotency-Key' => $key])
            ->assertCreated()
            ->assertJsonPath('data.sellerResponse.body', "Thank you for choosing us.\nWe appreciate your review.");

        $this->actingAs($seller)
            ->postJson("/api/v1/seller/reviews/{$review->id}/response", [
                'response' => "Thank you for choosing us.\nWe appreciate your review.",
            ], ['Idempotency-Key' => $key])
            ->assertOk();

        $this->actingAs($seller)
            ->postJson("/api/v1/seller/reviews/{$review->id}/response", [
                'response' => 'A second response is not allowed.',
            ], ['Idempotency-Key' => (string) Str::uuid()])
            ->assertStatus(409)
            ->assertJsonPath('code', 'SELLER_REVIEW_ALREADY_RESPONDED');

        $this->assertDatabaseCount('seller_review_responses', 1);
        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'average_rating' => '4.00',
            'review_count' => 1,
        ]);
        $this->assertDatabaseCount('notifications', 1);
        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $customer->id,
            'type' => 'customer-product-review.responded',
        ]);
        $this->actingAs($customer)
            ->getJson('/api/v1/customer/notifications')
            ->assertOk()
            ->assertJsonPath('data.0.destination', "/products/{$product->id}#product-reviews");

        $this->getJson("/api/v1/products/{$product->id}/reviews")
            ->assertOk()
            ->assertJsonPath('data.0.sellerResponse.shopName', $product->shop->name)
            ->assertJsonPath('data.0.sellerResponse.body', "Thank you for choosing us.\nWe appreciate your review.")
            ->assertJsonMissingPath('data.0.sellerResponse.seller_id')
            ->assertJsonMissingPath('data.0.sellerResponse.idempotency_key');
    }

    public function test_response_validation_rejects_markup_unknown_fields_and_reused_keys(): void
    {
        $product = $this->product();
        $seller = $product->shop->seller;
        $first = $this->review($product, $this->customer(), 2, 'Not what I expected.');
        $second = $this->review($product, $this->customer(), 5, 'Exactly as described.');
        $key = (string) Str::uuid();

        $this->actingAs($seller)
            ->postJson("/api/v1/seller/reviews/{$first->id}/response", [
                'response' => '<strong>Contact us</strong>',
                'status' => 'published',
            ], ['Idempotency-Key' => 'not-a-uuid'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['response', 'status', 'idempotency_key']);

        $this->actingAs($seller)
            ->postJson("/api/v1/seller/reviews/{$first->id}/response", [
                'response' => 'Thank you for the feedback.',
            ], ['Idempotency-Key' => $key])
            ->assertCreated();

        $this->actingAs($seller)
            ->postJson("/api/v1/seller/reviews/{$second->id}/response", [
                'response' => 'Thank you for the feedback.',
            ], ['Idempotency-Key' => $key])
            ->assertStatus(409)
            ->assertJsonPath('code', 'IDEMPOTENCY_KEY_REUSED');

        $this->actingAs($seller)
            ->getJson('/api/v1/seller/reviews?sort=oldest')
            ->assertStatus(422)
            ->assertJsonValidationErrors(['sort']);
    }

    public function test_owner_can_stream_an_archived_review_photo_without_making_it_public(): void
    {
        $disk = 'seller-review-test-'.Str::lower(Str::random(8));
        config(["filesystems.disks.{$disk}" => [
            'driver' => 'local',
            'root' => sys_get_temp_dir().'/'.$disk,
            'throw' => false,
        ]]);
        $product = $this->product();
        $review = $this->review($product, $this->customer(), 5, 'The finish looks great.');
        Storage::disk($disk)->put('reviews/example.png', 'safe-image-bytes');
        $image = ProductReviewImage::query()->create([
            'review_id' => $review->id,
            'customer_id' => $review->customer_id,
            'disk' => $disk,
            'path' => 'reviews/example.png',
            'mime_type' => 'image/png',
            'byte_size' => 16,
            'width' => 20,
            'height' => 20,
            'checksum' => hash('sha256', 'safe-image-bytes'),
            'status' => 'approved',
            'position' => 0,
        ]);
        $product->update(['status' => ProductStatus::Archived]);

        $this->actingAs($product->shop->seller)
            ->get("/api/v1/seller/reviews/{$review->id}/images/{$image->id}")
            ->assertOk()
            ->assertHeader('Content-Type', 'image/png')
            ->assertHeader('X-Content-Type-Options', 'nosniff');

        $this->get("/api/v1/product-review-images/{$image->id}")->assertNotFound();

        $product->delete();
        $this->actingAs($product->shop->seller)
            ->getJson("/api/v1/seller/reviews/{$review->id}")
            ->assertOk()
            ->assertJsonPath('data.product.isDeleted', true);
        $this->actingAs($product->shop->seller)
            ->get("/api/v1/seller/reviews/{$review->id}/images/{$image->id}")
            ->assertOk();
    }

    public function test_new_customer_review_notifies_the_seller_only_once(): void
    {
        $product = $this->product();
        $customer = $this->customer();
        $item = $this->order($customer, $product)->items()->firstOrFail();
        $payload = ['rating' => 5, 'body' => 'A dependable everyday camera.'];

        $this->actingAs($customer)
            ->postJson("/api/v1/customer/order-items/{$item->id}/review", $payload)
            ->assertCreated();
        $this->actingAs($customer)
            ->postJson("/api/v1/customer/order-items/{$item->id}/review", $payload)
            ->assertOk();

        $this->assertDatabaseCount('notifications', 1);
        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $product->shop->seller_id,
            'type' => 'seller-product-review.published',
        ]);
        $this->actingAs($product->shop->seller)
            ->getJson('/api/v1/seller/notifications')
            ->assertOk()
            ->assertJsonPath('data.0.destination', '/reviews/'.$this->firstReviewId());
    }

    private function product(): Product
    {
        $this->seed(ProductSeeder::class);

        return Product::query()->where('slug', 'compact-everyday-camera')->firstOrFail();
    }

    private function firstReviewId(): string
    {
        return ProductReview::query()->orderBy('created_at')->valueOrFail('id');
    }

    private function customer(): User
    {
        return User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
    }

    private function review(Product $product, User $customer, int $rating, string $body): ProductReview
    {
        $item = $this->order($customer, $product)->items()->firstOrFail();

        return ProductReview::query()->create([
            'customer_id' => $customer->id,
            'order_id' => $item->order_id,
            'order_item_id' => $item->id,
            'product_id' => $product->id,
            'product_name_snapshot' => $product->name,
            'rating' => $rating,
            'body' => $body,
            'status' => ProductReview::STATUS_PUBLISHED,
            'published_at' => now(),
        ]);
    }

    private function order(User $customer, Product $product): Order
    {
        $shop = Shop::query()->findOrFail($product->shop_id);
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
            'shop_id' => $shop->id,
            'reference' => 'ASL-SELLER-REVIEW-'.Str::upper(Str::random(8)),
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
