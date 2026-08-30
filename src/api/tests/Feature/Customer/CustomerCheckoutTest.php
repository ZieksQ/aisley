<?php

namespace Tests\Feature\Customer;

use App\Enums\AddressType;
use App\Enums\ProductStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Enums\VoucherBenefitType;
use App\Enums\VoucherIssuerType;
use App\Enums\VoucherValueType;
use App\Models\Address;
use App\Models\InventoryBalance;
use App\Models\InventoryMovement;
use App\Models\InventorySku;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Shop;
use App\Models\User;
use App\Models\Voucher;
use Database\Seeders\ProductSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerCheckoutTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ProductSeeder::class);
    }

    public function test_checkout_endpoints_require_an_active_customer_and_reject_forged_values(): void
    {
        $this->postJson('/api/v1/customer/checkout/quote', [])->assertUnauthorized();

        $seller = User::factory()->create(['role' => UserRole::Seller]);
        Sanctum::actingAs($seller);
        $this->postJson('/api/v1/customer/checkout/quote', [])->assertForbidden();

        $customer = $this->customer();
        $product = Product::where('slug', 'compact-everyday-camera')->firstOrFail();
        $payload = $this->buyNowPayload($product, $this->address($customer));
        $payload['total'] = '1.00';
        $payload['shipping_fee'] = '1.00';
        $payload['status'] = 'delivered';

        $this->postJson('/api/v1/customer/checkout/quote', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['total', 'shipping_fee', 'status']);
    }

    public function test_buy_now_places_one_cod_order_snapshots_address_reserves_stock_and_is_idempotent(): void
    {
        $customer = $this->customer();
        $address = $this->address($customer);
        $product = Product::where('slug', 'compact-everyday-camera')->firstOrFail();
        $payload = $this->buyNowPayload($product, $address, 2);

        $quote = $this->postJson('/api/v1/customer/checkout/quote', $payload)
            ->assertOk()
            ->assertJsonPath('data.summary.orderCount', 1)
            ->assertJsonPath('data.summary.payable', '13500.00')
            ->json('data');

        $key = (string) Str::uuid();
        $placePayload = [...$payload, 'quote_id' => $quote['quoteId']];
        $placed = $this->withHeader('Idempotency-Key', $key)
            ->postJson('/api/v1/customer/checkout/place', $placePayload)
            ->assertOk()
            ->assertJsonPath('data.orders.0.status', 'placed')
            ->assertJsonPath('data.orders.0.paymentMethod', 'cod')
            ->assertJsonPath('data.orders.0.items.0.quantity', 2)
            ->assertJsonPath('data.orders.0.address.recipientName', 'Ada Buyer')
            ->json('data');

        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseHas('inventory_balances', ['on_hand' => 14, 'reserved' => 2]);
        $this->assertDatabaseHas('inventory_movements', ['movement_type' => 'reserve', 'reserved_delta' => 2]);
        $this->assertDatabaseHas('products', ['id' => $product->id, 'stock_quantity' => 12]);

        $address->update(['recipient_name' => 'Changed Later']);
        $this->getJson('/api/v1/customer/checkout/'.$placed['id'])
            ->assertOk()
            ->assertJsonPath('data.orders.0.address.recipientName', 'Ada Buyer');

        $this->withHeader('Idempotency-Key', $key)
            ->postJson('/api/v1/customer/checkout/place', $placePayload)
            ->assertOk()
            ->assertJsonPath('data.id', $placed['id']);
        $this->assertDatabaseCount('orders', 1);
        $this->assertSame(1, InventoryMovement::where('movement_type', 'reserve')->count());
    }

    public function test_cart_checkout_groups_by_shop_and_removes_only_selected_lines(): void
    {
        $customer = $this->customer();
        $address = $this->address($customer);
        $first = Product::where('slug', 'compact-everyday-camera')->firstOrFail();
        $sameShop = Product::where('slug', 'classic-everyday-watch')->firstOrFail();
        $unselected = Product::where('slug', 'studio-wireless-headphones')->firstOrFail();
        $unselectedVariant = ProductVariant::where('sku', 'AWH-BLK')->firstOrFail();
        $second = $this->secondShopProduct();

        $firstId = $this->postJson('/api/v1/customer/cart/items', ['product_id' => $first->id, 'variant_id' => null, 'quantity' => 1])->json('data.items.0.id');
        $sameShopId = collect($this->postJson('/api/v1/customer/cart/items', ['product_id' => $sameShop->id, 'variant_id' => null, 'quantity' => 1])->json('data.items'))->firstWhere('product.id', $sameShop->id)['id'];
        $this->postJson('/api/v1/customer/cart/items', ['product_id' => $unselected->id, 'variant_id' => $unselectedVariant->id, 'quantity' => 1])->assertOk();
        $secondId = collect($this->postJson('/api/v1/customer/cart/items', ['product_id' => $second->id, 'variant_id' => null, 'quantity' => 1])->json('data.items'))->firstWhere('product.id', $second->id)['id'];

        $payload = ['mode' => 'cart', 'cart_item_ids' => [$firstId, $sameShopId, $secondId], 'address_id' => $address->id, 'payment_method' => 'cod', 'vouchers' => []];
        $quote = $this->postJson('/api/v1/customer/checkout/quote', $payload)
            ->assertOk()->assertJsonPath('data.summary.orderCount', 2)->json('data');
        $batch = $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/customer/checkout/place', [...$payload, 'quote_id' => $quote['quoteId']])
            ->assertOk()->json('data');

        $this->assertCount(2, $batch['orders']);
        $this->assertTrue(collect($batch['orders'])->contains(fn (array $order) => count($order['items']) === 2));
        $this->assertSame($batch['id'], Order::firstOrFail()->checkout_batch_id);
        $this->assertDatabaseMissing('cart_items', ['id' => $firstId]);
        $this->assertDatabaseMissing('cart_items', ['id' => $secondId]);
        $this->assertDatabaseHas('cart_items', ['product_id' => $unselected->id]);
    }

    public function test_shop_and_app_vouchers_are_scoped_calculated_and_redeemed_once(): void
    {
        $customer = $this->customer();
        $address = $this->address($customer);
        $product = Product::where('slug', 'compact-everyday-camera')->firstOrFail();
        $voucher = Voucher::create([
            'code' => 'SHOP10', 'issuer_type' => VoucherIssuerType::Shop, 'shop_id' => $product->shop_id,
            'benefit_type' => VoucherBenefitType::Discount, 'value_type' => VoucherValueType::Percent,
            'value' => '10.00', 'maximum_discount' => '1000.00', 'minimum_spend' => '5000.00',
            'starts_at' => now()->subDay(), 'ends_at' => now()->addDay(), 'per_customer_limit' => 1,
            'terms_summary' => '10% off this Shop order.', 'stacking_policy' => [],
        ]);
        $payload = $this->buyNowPayload($product, $address);
        $payload['vouchers'] = [['voucher_id' => $voucher->id, 'target_shop_id' => $product->shop_id]];

        $quote = $this->postJson('/api/v1/customer/checkout/quote', $payload)
            ->assertOk()
            ->assertJsonPath('data.groups.0.appliedVouchers.0.discountAmount', '675.00')
            ->assertJsonPath('data.summary.payable', '6075.00')
            ->json('data');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/customer/checkout/place', [...$payload, 'quote_id' => $quote['quoteId']])
            ->assertOk();

        $this->assertDatabaseHas('voucher_redemptions', ['voucher_id' => $voucher->id, 'customer_id' => $customer->id, 'discount_amount' => '675.00']);
        $this->assertDatabaseHas('order_vouchers', ['code' => 'SHOP10', 'terms_summary' => '10% off this Shop order.']);
        $this->assertSame(1, $voucher->fresh()->redeemed_count);
    }

    public function test_one_app_voucher_is_allocated_only_to_the_explicit_multi_shop_target(): void
    {
        $customer = $this->customer();
        $address = $this->address($customer);
        $first = Product::where('slug', 'compact-everyday-camera')->firstOrFail();
        $second = $this->secondShopProduct();
        $firstId = $this->postJson('/api/v1/customer/cart/items', ['product_id' => $first->id, 'variant_id' => null, 'quantity' => 1])->json('data.items.0.id');
        $secondId = collect($this->postJson('/api/v1/customer/cart/items', ['product_id' => $second->id, 'variant_id' => null, 'quantity' => 1])->json('data.items'))->firstWhere('product.id', $second->id)['id'];
        $voucher = Voucher::create([
            'code' => 'APP50', 'issuer_type' => VoucherIssuerType::App, 'shop_id' => null,
            'benefit_type' => VoucherBenefitType::Discount, 'value_type' => VoucherValueType::Fixed,
            'value' => '50.00', 'minimum_spend' => '50.00', 'starts_at' => now()->subDay(),
            'ends_at' => now()->addDay(), 'per_customer_limit' => 1,
            'terms_summary' => 'PHP 50 off one explicitly selected Shop order.',
        ]);
        $payload = [
            'mode' => 'cart', 'cart_item_ids' => [$firstId, $secondId], 'address_id' => $address->id,
            'payment_method' => 'cod',
            'vouchers' => [['voucher_id' => $voucher->id, 'target_shop_id' => $second->shop_id]],
        ];

        $groups = collect($this->postJson('/api/v1/customer/checkout/quote', $payload)
            ->assertOk()->json('data.groups'))->keyBy('shop.id');

        $this->assertCount(0, $groups[$first->shop_id]['appliedVouchers']);
        $this->assertSame('50.00', $groups[$second->shop_id]['appliedVouchers'][0]['discountAmount']);
        $this->assertSame('50.00', $groups[$second->shop_id]['totals']['payable']);
    }

    public function test_stale_quote_and_foreign_address_roll_back_without_orders_or_reservations(): void
    {
        $customer = $this->customer();
        $address = $this->address($customer);
        $product = Product::where('slug', 'compact-everyday-camera')->firstOrFail();
        $payload = $this->buyNowPayload($product, $address);
        $quoteId = $this->postJson('/api/v1/customer/checkout/quote', $payload)->json('data.quoteId');
        $product->update(['price' => '7000.00']);

        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/customer/checkout/place', [...$payload, 'quote_id' => $quoteId])
            ->assertConflict()->assertJsonPath('code', 'QUOTE_STALE');
        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseHas('inventory_balances', ['on_hand' => 14, 'reserved' => 0]);

        $other = User::factory()->create();
        $foreign = $this->address($other);
        $payload['address_id'] = $foreign->id;
        $this->postJson('/api/v1/customer/checkout/quote', $payload)
            ->assertUnprocessable()->assertJsonPath('code', 'ADDRESS_NOT_FOUND');
    }

    private function customer(): User
    {
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        Sanctum::actingAs($customer);

        return $customer;
    }

    private function address(User $customer): Address
    {
        return Address::create([
            'user_id' => $customer->id, 'type' => AddressType::Shipping, 'label' => 'Home',
            'recipient_name' => 'Ada Buyer', 'contact_number' => '09171234567',
            'address_line_1' => '123 Test Street', 'barangay' => 'San Antonio',
            'city_municipality' => 'Makati City', 'province' => 'Metro Manila',
            'region' => 'NCR', 'postal_code' => '1203', 'country' => 'Philippines',
        ]);
    }

    /** @return array<string, mixed> */
    private function buyNowPayload(Product $product, Address $address, int $quantity = 1): array
    {
        return ['mode' => 'buy_now', 'buy_now' => ['product_id' => $product->id, 'variant_id' => null, 'quantity' => $quantity], 'address_id' => $address->id, 'payment_method' => 'cod', 'vouchers' => []];
    }

    private function secondShopProduct(): Product
    {
        $seller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
        $shop = Shop::create(['seller_id' => $seller->id, 'name' => 'Second Store', 'slug' => 'second-store', 'status' => ShopStatus::Active]);
        $product = Product::create(['shop_id' => $shop->id, 'name' => 'Second Product', 'slug' => 'second-product', 'price' => '100.00', 'stock_quantity' => 5, 'status' => ProductStatus::Active, 'published_at' => now()->subMinute()]);
        $sku = InventorySku::create(['product_id' => $product->id, 'code' => 'SECOND-BASE', 'is_base' => true]);
        InventoryBalance::create(['inventory_sku_id' => $sku->id, 'on_hand' => 5, 'reserved' => 0]);

        return $product;
    }
}
