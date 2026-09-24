<?php

namespace Tests\Feature\Customer;

use App\Enums\CategoryStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\ProductStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Category;
use App\Models\CheckoutBatch;
use App\Models\CheckoutQuote;
use App\Models\Conversation;
use App\Models\CustomerProfile;
use App\Models\Message;
use App\Models\Order;
use App\Models\Product;
use App\Models\Shop;
use App\Models\ShopCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class CustomerChatMessagingTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_and_seller_share_one_private_thread_with_idempotent_messages_and_unread_state(): void
    {
        $shop = $this->shop();
        $customer = $this->customer();
        $other = $this->customer();
        $this->getJson('/api/v1/customer/conversations')->assertUnauthorized();
        $this->actingAs($shop->seller)->getJson('/api/v1/customer/conversations')->assertForbidden();

        $key = (string) Str::uuid();
        $response = $this->actingAs($customer)->postJson('/api/v1/customer/conversations', [
            'shop_id' => $shop->id, 'body' => ' Is this available? ',
        ], ['Idempotency-Key' => $key])->assertCreated()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('message.body', 'Is this available?')
            ->assertJsonPath('message.sequence', 1);
        $id = $response->json('conversation.id');
        $this->postJson('/api/v1/customer/conversations', [
            'shop_id' => $shop->id, 'body' => 'Is this available?',
        ], ['Idempotency-Key' => $key])->assertCreated()->assertJsonPath('conversation.id', $id);
        $this->assertDatabaseCount('conversations', 1);
        $this->assertDatabaseCount('messages', 1);
        $this->postJson('/api/v1/customer/conversations', [
            'shop_id' => $shop->id, 'body' => 'Different',
        ], ['Idempotency-Key' => $key])->assertConflict();
        $this->actingAs($other)->getJson("/api/v1/customer/conversations/{$id}")->assertNotFound();
        $this->actingAs($shop->seller)->getJson("/api/v1/seller/conversations/{$id}")
            ->assertOk()->assertJsonPath('data.unread_count', 1)->assertJsonMissingPath('data.customer_email');
        $this->postJson("/api/v1/seller/conversations/{$id}/messages", ['body' => 'Yes, it is.'], [
            'Idempotency-Key' => (string) Str::uuid(),
        ])->assertCreated()->assertJsonPath('message.sequence', 2);
        $this->getJson('/api/v1/seller/conversations/unread-count')->assertOk()->assertJsonPath('unread_count', 1);
        $this->actingAs($customer)->getJson('/api/v1/customer/conversations/unread-count')
            ->assertOk()->assertJsonPath('unread_count', 1);
        $this->postJson("/api/v1/customer/conversations/{$id}/read", ['sequence' => 2])
            ->assertOk()->assertJsonPath('data.unread_count', 0);
        $this->postJson("/api/v1/customer/conversations/{$id}/read", ['sequence' => 1])
            ->assertOk()->assertJsonPath('data.last_read_sequence', 2);
        $this->postJson("/api/v1/customer/conversations/{$id}/read", ['sequence' => 99])->assertUnprocessable();
        $this->getJson("/api/v1/customer/conversations/{$id}/messages")
            ->assertOk()->assertJsonCount(2, 'items')->assertJsonPath('items.0.body', 'Is this available?');
    }

    public function test_context_and_seller_boundaries_fail_closed_while_history_survives_suspension(): void
    {
        $shop = $this->shop();
        $anotherShop = $this->shop();
        $customer = $this->customer();
        $product = $this->product($shop);
        $this->actingAs($customer)->postJson('/api/v1/customer/conversations', [
            'shop_id' => $anotherShop->id, 'body' => 'Wrong Shop', 'context_type' => 'product', 'context_id' => $product->id,
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertUnprocessable();
        $response = $this->postJson('/api/v1/customer/conversations', [
            'shop_id' => $shop->id, 'body' => 'About this item', 'context_type' => 'product', 'context_id' => $product->id,
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertCreated();
        $id = $response->json('conversation.id');
        $this->actingAs($anotherShop->seller)->getJson("/api/v1/seller/conversations/{$id}")->assertNotFound();
        $product->update(['status' => ProductStatus::Archived]);
        $this->actingAs($customer)->getJson("/api/v1/customer/conversations/{$id}/messages")
            ->assertOk()->assertJsonPath('items.0.context.label', 'Product unavailable');
        $shop->seller->update(['status' => UserStatus::Suspended]);
        $this->getJson("/api/v1/customer/conversations/{$id}")
            ->assertOk()->assertJsonPath('data.send_allowed', false);
        $this->postJson("/api/v1/customer/conversations/{$id}/messages", ['body' => 'Can you reply?'], [
            'Idempotency-Key' => (string) Str::uuid(),
        ])->assertStatus(409);
        $this->assertDatabaseCount('messages', 1);
        $this->assertDatabaseCount('conversations', 1);
    }

    public function test_order_context_is_customer_and_shop_scoped_and_reuses_the_existing_thread(): void
    {
        $customer = $this->customer();
        $otherCustomer = $this->customer();
        $firstShop = $this->shop();
        $secondShop = $this->shop();
        $firstOrder = $this->order($customer, $firstShop);
        $otherOrder = $this->order($otherCustomer, $secondShop);

        $this->actingAs($customer)->postJson('/api/v1/customer/conversations', [
            'shop_id' => $firstShop->id, 'body' => 'Wrong Shop', 'context_type' => 'order', 'context_id' => $otherOrder->id,
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertUnprocessable();
        $this->postJson('/api/v1/customer/conversations', [
            'shop_id' => $secondShop->id, 'body' => 'Wrong owner', 'context_type' => 'order', 'context_id' => $otherOrder->id,
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertUnprocessable();

        $first = $this->postJson('/api/v1/customer/conversations', [
            'shop_id' => $firstShop->id, 'body' => 'About my order', 'context_type' => 'order', 'context_id' => $firstOrder->id,
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertCreated()
            ->assertJsonPath('message.context.label', 'Order '.$firstOrder->reference);
        $this->postJson('/api/v1/customer/conversations', [
            'shop_id' => $firstShop->id, 'body' => 'A second question',
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertCreated()
            ->assertJsonPath('conversation.id', $first->json('conversation.id'));
        $this->assertDatabaseCount('conversations', 1);
        $this->assertDatabaseCount('messages', 2);
    }

    public function test_text_validation_and_seller_shop_suspension_preserve_private_history(): void
    {
        $shop = $this->shop();
        $customer = $this->customer();
        $this->actingAs($customer)->postJson('/api/v1/customer/conversations', [
            'shop_id' => $shop->id, 'body' => '   ',
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertUnprocessable();
        $this->postJson('/api/v1/customer/conversations', [
            'shop_id' => $shop->id, 'body' => 'No send key',
        ])->assertUnprocessable();
        $this->postJson('/api/v1/customer/conversations', [
            'shop_id' => $shop->id, 'body' => str_repeat('x', 2001),
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertUnprocessable();
        $this->postJson('/api/v1/customer/conversations', [
            'shop_id' => $shop->id, 'body' => 'Hello', 'attachments' => ['anything'],
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertUnprocessable();
        $this->assertDatabaseCount('conversations', 0);

        $id = $this->postJson('/api/v1/customer/conversations', [
            'shop_id' => $shop->id, 'body' => '<script>plain text</script>',
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertCreated()->json('conversation.id');
        $this->getJson("/api/v1/customer/conversations/{$id}/messages")
            ->assertOk()->assertJsonPath('items.0.body', '<script>plain text</script>');
        $shop->update(['status' => ShopStatus::Suspended]);
        $this->actingAs($shop->seller)->getJson("/api/v1/seller/conversations/{$id}")
            ->assertOk()->assertJsonPath('data.send_allowed', false);
        $this->postJson("/api/v1/seller/conversations/{$id}/messages", ['body' => 'Reply'], [
            'Idempotency-Key' => (string) Str::uuid(),
        ])->assertStatus(409);
        $this->assertDatabaseCount('messages', 1);
    }

    public function test_history_cursor_and_unread_totals_remain_bounded_after_many_messages(): void
    {
        $shop = $this->shop();
        $customer = $this->customer();
        $id = $this->actingAs($customer)->postJson('/api/v1/customer/conversations', [
            'shop_id' => $shop->id, 'body' => 'First message',
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertCreated()->json('conversation.id');

        for ($sequence = 2; $sequence <= 35; $sequence++) {
            $message = Message::create([
                'conversation_id' => $id, 'sender_user_id' => $shop->seller_id,
                'sequence' => $sequence, 'idempotency_key' => (string) Str::uuid(),
                'payload_hash' => hash('sha256', (string) $sequence), 'body' => "Reply {$sequence}",
            ]);
            Conversation::whereKey($id)->update([
                'last_sequence' => $sequence, 'last_message_id' => $message->id,
                'last_message_at' => $message->created_at,
            ]);
        }

        $page = $this->getJson("/api/v1/customer/conversations/{$id}/messages")
            ->assertOk()->assertJsonCount(30, 'items')
            ->assertJsonPath('items.0.sequence', 6)->assertJsonPath('items.29.sequence', 35);
        $cursor = $page->json('next_cursor');
        $this->assertNotNull($cursor);
        $this->getJson("/api/v1/customer/conversations/{$id}/messages?cursor=".urlencode($cursor))
            ->assertOk()->assertJsonCount(5, 'items')->assertJsonPath('items.0.sequence', 1);
        $this->getJson('/api/v1/customer/conversations/unread-count')
            ->assertOk()->assertJsonPath('unread_count', 34);
        $this->postJson("/api/v1/customer/conversations/{$id}/read", ['sequence' => 35])
            ->assertOk()->assertJsonPath('data.unread_count', 0);
    }

    private function customer(): User
    {
        $user = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        CustomerProfile::create([
            'user_id' => $user->id, 'first_name' => 'Buyer', 'last_name' => 'One',
            'contact_number' => '09171234567', 'sex' => 'prefer_not_to_say', 'birth_date' => '2000-01-01',
        ]);

        return $user;
    }

    private function shop(): Shop
    {
        $category = ShopCategory::firstOrCreate(['slug' => 'general'], [
            'name' => 'General', 'status' => CategoryStatus::Active, 'position' => 0,
        ]);
        $seller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);

        return Shop::create([
            'seller_id' => $seller->id, 'shop_category_id' => $category->id,
            'name' => 'Shop '.Str::random(5), 'slug' => 'shop-'.Str::lower(Str::random(8)),
            'status' => ShopStatus::Active, 'is_on_vacation' => false,
        ]);
    }

    private function product(Shop $shop): Product
    {
        $category = Category::create([
            'shop_category_id' => $shop->shop_category_id,
            'name' => 'Products '.Str::random(4), 'slug' => 'products-'.Str::lower(Str::random(8)),
            'status' => CategoryStatus::Active, 'position' => 0,
        ]);

        return Product::create([
            'shop_id' => $shop->id, 'category_id' => $category->id,
            'name' => 'Test product', 'slug' => 'test-product-'.Str::lower(Str::random(8)),
            'price' => 100, 'stock_quantity' => 5, 'review_count' => 0, 'sold_count' => 0,
            'badges' => [], 'status' => ProductStatus::Active, 'published_at' => now()->subHour(),
        ]);
    }

    private function order(User $customer, Shop $shop): Order
    {
        $quote = CheckoutQuote::create([
            'customer_id' => $customer->id, 'input_payload' => [],
            'request_hash' => hash('sha256', (string) Str::uuid()),
            'state_hash' => hash('sha256', (string) Str::uuid()),
            'expires_at' => now()->addHour(),
        ]);
        $batch = CheckoutBatch::create([
            'customer_id' => $customer->id, 'checkout_quote_id' => $quote->id,
            'idempotency_key' => (string) Str::uuid(),
            'request_hash' => hash('sha256', (string) Str::uuid()),
            'currency' => 'PHP', 'placed_at' => now(),
        ]);
        $order = Order::create([
            'checkout_batch_id' => $batch->id, 'customer_id' => $customer->id,
            'shop_id' => $shop->id, 'reference' => 'CHAT-'.Str::upper(Str::random(10)),
            'status' => OrderStatus::Placed, 'payment_method' => PaymentMethod::CashOnDelivery,
            'payment_status' => PaymentStatus::Pending, 'currency' => 'PHP',
            'merchandise_subtotal' => '15.00', 'shipping_fee' => '5.00',
            'payable_total' => '20.00', 'placed_at' => now(),
        ]);
        $order->items()->create([
            'product_name' => 'Snapshot Product', 'unit_price' => '15.00',
            'quantity' => 1, 'line_subtotal' => '15.00', 'currency' => 'PHP',
        ]);

        return $order;
    }
}
