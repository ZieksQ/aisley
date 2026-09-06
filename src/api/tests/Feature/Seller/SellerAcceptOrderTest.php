<?php

namespace Tests\Feature\Seller;

use App\Enums\CategoryStatus;
use App\Enums\InventoryMovementType;
use App\Enums\InventorySkuStatus;
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
use App\Models\InventoryBalance;
use App\Models\InventoryMovement;
use App\Models\InventorySku;
use App\Models\Order;
use App\Models\Product;
use App\Models\Shop;
use App\Models\ShopCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class SellerAcceptOrderTest extends TestCase
{
    use RefreshDatabase;

    public function test_seller_orders_are_shop_scoped_and_require_an_active_seller(): void
    {
        [$seller, $shop] = $this->sellerShop('owner');
        [, $foreignShop] = $this->sellerShop('foreign');
        $order = $this->order($shop);
        $foreignOrder = $this->order($foreignShop);
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);

        $this->getJson('/api/v1/seller/orders')->assertUnauthorized();
        $this->actingAs($customer)->getJson('/api/v1/seller/orders')->assertForbidden();
        $this->actingAs($seller)->getJson('/api/v1/seller/orders')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $order->id);
        $this->getJson("/api/v1/seller/orders/{$foreignOrder->id}")->assertNotFound();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson("/api/v1/seller/orders/{$foreignOrder->id}/accept")
            ->assertNotFound();
    }

    public function test_seller_acceptance_is_idempotent_and_does_not_touch_payment_or_inventory(): void
    {
        [$seller, $shop] = $this->sellerShop();
        $order = $this->order($shop);
        $balance = InventoryBalance::firstOrFail();
        $before = [$balance->on_hand, $balance->reserved, InventoryMovement::count()];
        $key = (string) Str::uuid();

        $this->actingAs($seller)->postJson("/api/v1/seller/orders/{$order->id}/accept")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('idempotency_key');
        $this->postJson("/api/v1/seller/orders/{$order->id}/accept", ['status' => 'delivered'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('status');

        $this->withHeader('Idempotency-Key', $key)
            ->postJson("/api/v1/seller/orders/{$order->id}/accept")
            ->assertOk()
            ->assertJsonPath('data.status', OrderStatus::SellerProcessing->value)
            ->assertJsonPath('data.payment.method', PaymentMethod::CashOnDelivery->value)
            ->assertJsonPath('data.payment.status', PaymentStatus::Pending->value)
            ->assertJsonPath('data.capabilities.can_accept', false)
            ->assertJsonPath('data.capabilities.can_prepare', true);

        $this->withHeader('Idempotency-Key', $key)
            ->postJson("/api/v1/seller/orders/{$order->id}/accept")
            ->assertOk()
            ->assertJsonPath('data.status', OrderStatus::SellerProcessing->value);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson("/api/v1/seller/orders/{$order->id}/accept")
            ->assertConflict()
            ->assertJsonPath('code', 'ORDER_NOT_ACCEPTABLE');

        $order->refresh();
        $balance->refresh();
        $this->assertSame(OrderStatus::SellerProcessing, $order->status);
        $this->assertSame(PaymentStatus::Pending, $order->payment_status);
        $this->assertSame($before, [$balance->on_hand, $balance->reserved, InventoryMovement::count()]);
        $this->assertSame(2, $order->statusEvents()->count());
        $this->assertDatabaseCount('seller_order_acceptances', 1);
        $this->getJson("/api/v1/seller/orders/{$order->id}/waybill")
            ->assertNotFound()
            ->assertJsonPath('code', 'WAYBILL_NOT_AVAILABLE');
    }

    public function test_acceptance_requires_the_existing_reservation_and_notification_read_is_independent(): void
    {
        [$seller, $shop] = $this->sellerShop();
        $invalid = $this->order($shop);
        InventoryBalance::firstOrFail()->update(['reserved' => 0]);

        $this->actingAs($seller)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson("/api/v1/seller/orders/{$invalid->id}/accept")
            ->assertConflict()
            ->assertJsonPath('code', 'INVENTORY_RESERVATION_INVALID');
        $this->assertSame(OrderStatus::Placed, $invalid->fresh()->status);

        $valid = $this->order($shop, 'SECOND');
        $notificationId = (string) Str::uuid();
        $seller->notifications()->create([
            'id' => $notificationId,
            'type' => 'seller-order.actionable',
            'data' => ['order_id' => $valid->id, 'order_reference' => $valid->reference],
        ]);

        $this->postJson("/api/v1/seller/notifications/{$notificationId}/read")
            ->assertOk()
            ->assertJsonPath('data.id', $notificationId);
        $this->getJson('/api/v1/seller/orders?notification=read')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $valid->id);
        $this->assertSame(OrderStatus::Placed, $valid->fresh()->status);
        $this->assertNotNull($seller->notifications()->findOrFail($notificationId)->read_at);
    }

    public function test_order_inbox_filters_history_and_notifications_with_bounded_pagination(): void
    {
        [$seller, $shop] = $this->sellerShop();
        [, $foreignShop] = $this->sellerShop('foreign');
        $cancelled = $this->order($shop, 'CANCELLED');
        $cancelled->update(['status' => OrderStatus::Cancelled]);
        $placed = $this->order($shop, 'PLACED');
        $foreign = $this->order($foreignShop, 'FOREIGN');
        foreach ([$placed, $foreign] as $order) {
            $seller->notifications()->create([
                'id' => (string) Str::uuid(), 'type' => 'seller-order.actionable',
                'data' => ['order_id' => $order->id, 'order_reference' => $order->reference],
            ]);
        }

        $this->actingAs($seller)->getJson('/api/v1/seller/orders?notification=unread')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $placed->id);
        $this->getJson('/api/v1/seller/orders?status=cancelled')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $cancelled->id)
            ->assertJsonPath('data.0.capabilities.can_accept', false);
        $this->getJson('/api/v1/seller/orders?per_page=1&page=2')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.total', 2)
            ->assertJsonPath('meta.current_page', 2);
        $this->getJson('/api/v1/seller/orders?status=unknown')->assertUnprocessable();
        $this->getJson('/api/v1/seller/orders?page=-1')->assertUnprocessable();
        $this->getJson('/api/v1/seller/orders?per_page=51')->assertUnprocessable();
    }

    /** @return array{User, Shop} */
    private function sellerShop(string $suffix = 'one'): array
    {
        $seller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
        $shopCategory = ShopCategory::create(['name' => "General {$suffix}", 'slug' => "general-{$suffix}", 'status' => CategoryStatus::Active]);
        $shop = Shop::create(['seller_id' => $seller->id, 'shop_category_id' => $shopCategory->id, 'name' => "Shop {$suffix}", 'slug' => "shop-{$suffix}", 'status' => ShopStatus::Active]);

        return [$seller, $shop];
    }

    private function order(Shop $shop, string $referenceSuffix = 'ONE'): Order
    {
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $category = Category::create([
            'shop_category_id' => $shop->shop_category_id,
            'name' => 'Category '.Str::lower(Str::random(6)),
            'slug' => 'category-'.Str::lower(Str::random(10)),
            'status' => CategoryStatus::Active,
        ]);
        $product = Product::create([
            'shop_id' => $shop->id, 'category_id' => $category->id, 'name' => 'Snapshot product',
            'slug' => 'snapshot-'.Str::lower(Str::random(10)), 'base_sku' => 'SNAP-'.Str::upper(Str::random(6)),
            'price' => '100.00', 'currency' => 'PHP', 'stock_quantity' => 10, 'status' => ProductStatus::Active,
            'published_at' => now(),
        ]);
        $sku = InventorySku::create([
            'product_id' => $product->id, 'shop_id' => $shop->id, 'code' => $product->base_sku,
            'is_base' => true, 'status' => InventorySkuStatus::Active,
        ]);
        $balance = InventoryBalance::create(['inventory_sku_id' => $sku->id, 'on_hand' => 10, 'reserved' => 1]);
        $quote = CheckoutQuote::create([
            'customer_id' => $customer->id, 'input_payload' => [], 'request_hash' => str_repeat('a', 64),
            'state_hash' => str_repeat('b', 64), 'expires_at' => now()->addHour(),
        ]);
        $batch = CheckoutBatch::create([
            'customer_id' => $customer->id, 'checkout_quote_id' => $quote->id, 'idempotency_key' => (string) Str::uuid(),
            'request_hash' => str_repeat('c', 64), 'currency' => 'PHP', 'placed_at' => now(),
        ]);
        $order = Order::create([
            'checkout_batch_id' => $batch->id, 'customer_id' => $customer->id, 'shop_id' => $shop->id,
            'reference' => 'ASL-TEST-'.$referenceSuffix.'-'.Str::upper(Str::random(5)),
            'status' => OrderStatus::Placed, 'payment_method' => PaymentMethod::CashOnDelivery,
            'payment_status' => PaymentStatus::Pending, 'currency' => 'PHP', 'merchandise_subtotal' => '100.00',
            'shipping_fee' => '0.00', 'discount_total' => '0.00', 'shipping_discount_total' => '0.00',
            'payable_total' => '100.00', 'placed_at' => now(),
        ]);
        $order->items()->create([
            'product_id' => $product->id, 'product_name' => 'Snapshot product', 'sku' => $sku->code,
            'selected_options' => [], 'unit_price' => '100.00', 'quantity' => 1, 'line_subtotal' => '100.00', 'currency' => 'PHP',
        ]);
        $order->address()->create([
            'recipient_name' => 'Buyer', 'contact_number' => '09171234567', 'address_line_1' => '1 Test Street',
            'barangay' => 'Barangay Test', 'city_municipality' => 'Manila', 'province' => 'Metro Manila',
            'region' => 'NCR', 'postal_code' => '1000', 'country' => 'PH',
        ]);
        $order->statusEvents()->create(['to_status' => OrderStatus::Placed, 'source' => 'customer_checkout', 'occurred_at' => now()]);
        InventoryMovement::create([
            'inventory_balance_id' => $balance->id, 'movement_type' => InventoryMovementType::Reserve,
            'on_hand_delta' => 0, 'reserved_delta' => 1, 'resulting_on_hand' => 10, 'resulting_reserved' => 1,
            'reference_type' => 'checkout_batch', 'reference_id' => $batch->id,
        ]);

        return $order;
    }
}
