<?php

namespace Tests\Support;

use App\Enums\AddressType;
use App\Enums\CategoryStatus;
use App\Enums\CourierAffiliationStatus;
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
use App\Models\HubConnection;
use App\Models\HubServiceArea;
use App\Models\InventoryBalance;
use App\Models\InventoryMovement;
use App\Models\InventorySku;
use App\Models\LogisticsHub;
use App\Models\Order;
use App\Models\Product;
use App\Models\Shop;
use App\Models\ShopCategory;
use App\Models\User;
use App\Models\Waybill;
use Illuminate\Support\Str;

trait HubRoutingFixtures
{
    private function pinnedHub(): array
    {
        $context = $this->logistics();
        $context[2]->address->update(['latitude' => 14 + LogisticsHub::count() / 10000, 'longitude' => 121 + LogisticsHub::count() / 10000]);
        $context[2]->update(['name' => 'Hub '.Str::random(6)]);

        return $context;
    }

    private function area($hub): void
    {
        HubServiceArea::create(['logistics_hub_id' => $hub->id, 'postal_code' => '6000', 'created_by' => $hub->organization->user_id]);
    }

    private function edge($from, $to): void
    {
        HubConnection::create(['from_hub_id' => $from->id, 'to_hub_id' => $to->id, 'created_by' => $from->organization->user_id]);
    }

    private function pickupAt(array $context): array
    {
        [$seller, $shop] = $this->sellerShop();
        $order = $this->order($shop);
        $order->update(['status' => OrderStatus::SellerProcessing]);
        $pickup = $this->actingAs($seller)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/seller/orders/pickup-requests', [
            'order_ids' => [$order->id], 'pickup_address_id' => $seller->addresses()->sole()->id, 'logistics_organization_id' => $context[1]->id,
        ])->assertOk()->json('data');

        return [$order, $pickup['waybills'][0]['reference']];
    }

    private function receiveOrigin(array $context, string $reference): void
    {
        $order = Waybill::where('reference', $reference)->sole()->order;
        $courier = $this->courier($context[1]->id, $context[2]->id);
        $this->actingAs($context[0])->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/pickup-schedules', [
            'order_ids' => [$order->id], 'courier_id' => $courier->id, 'starts_at' => now()->addHours(3)->toISOString(), 'ends_at' => now()->addHours(4)->toISOString(),
        ])->assertCreated();
        $task = $this->actingAs($courier)->getJson('/api/v1/courier/first-mile-tasks')->assertOk()->json('data.0');
        $this->postJson('/api/v1/courier/first-mile-tasks/'.$task['id'].'/accept')->assertOk();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/courier/first-mile-tasks/'.$task['id'].'/pickup', ['identifier_type' => 'tracking_id', 'identifier' => $reference])->assertOk();
        $this->actingAs($context[0])->postJson('/api/v1/logistics/receiving/batches', ['receipts' => [['client_id' => (string) Str::uuid(), 'reference' => $reference, 'scanned_at' => now()->toISOString()]]])->assertOk()->assertJsonPath('summary.received', 1);
    }

    private function sortFor(array $context, string $reference, ?string $next): array
    {
        $this->actingAs($context[0]);
        $lane = $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'STD', 'name' => 'Routing lane', 'type' => 'standard'])->assertCreated()->json('data');
        $plan = $this->postJson('/api/v1/logistics/sorting/plans', ['name' => 'Route plan', 'is_active' => true])->assertCreated()->json('data');
        $destination = $next ? ['destination_type' => 'hub', 'destination_hub_id' => $next] : ['postal_code' => '6000'];
        $this->postJson('/api/v1/logistics/sorting/plans/'.$plan['id'].'/lanes', ['expected_revision' => $plan['revision'], 'lane_id' => $lane['id'], ...$destination])->assertOk();
        $session = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/sessions')->assertCreated()->json('data');
        $this->postJson('/api/v1/logistics/sorting/sessions/'.$session['id'].'/batches', ['captures' => [[
            'client_id' => (string) Str::uuid(), 'lane_id' => null, 'auto_route' => true, 'reference' => $reference,
            'expected_revision' => $session['items'][0]['expected_revision'], 'source' => 'barcode', 'captured_at' => now()->toISOString(),
        ]]])->assertOk()->assertJsonPath('summary.sorted', 1);

        return $this->getJson('/api/v1/logistics/update-status/records/'.$reference)->assertOk()->json('data');
    }

    private function sellerShop(): array
    {
        $seller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
        $category = ShopCategory::create(['name' => 'General '.Str::random(5), 'slug' => 'general-'.Str::lower(Str::random(8)), 'status' => CategoryStatus::Active]);
        $shop = Shop::create(['seller_id' => $seller->id, 'shop_category_id' => $category->id, 'name' => 'Seller Shop', 'slug' => 'seller-'.Str::lower(Str::random(8)), 'status' => ShopStatus::Active, 'contact_number' => '09171111111']);
        $seller->addresses()->create(['type' => AddressType::Both, 'label' => 'Pickup', 'recipient_name' => 'Seller', 'contact_number' => '09171111111', 'address_line_1' => '1 Seller Road', 'barangay' => 'Ermita', 'city_municipality' => 'Manila', 'province' => 'Metro Manila', 'region' => 'NCR', 'postal_code' => '1000', 'country' => 'PH', 'is_default' => true]);

        return [$seller, $shop];
    }

    private function logistics(): array
    {
        $user = User::factory()->create(['role' => UserRole::Logistics, 'status' => UserStatus::Active]);
        $address = $user->addresses()->create(['type' => AddressType::Both, 'label' => 'Hub', 'recipient_name' => 'Operator', 'contact_number' => '09172222222', 'address_line_1' => '1 Hub Road', 'barangay' => 'Poblacion', 'city_municipality' => 'Manila', 'province' => 'Metro Manila', 'region' => 'NCR', 'postal_code' => '1000', 'country' => 'PH', 'is_default' => true]);
        $organization = $user->logisticsOrganization()->create(['business_name' => 'Aisley Logistics']);
        $hub = $organization->hub()->create(['address_id' => $address->id, 'name' => 'Aisley Hub']);

        return [$user, $organization, $hub];
    }

    private function courier(string $organizationId, string $hubId): User
    {
        $courier = User::factory()->create(['role' => UserRole::Courier, 'status' => UserStatus::Active]);
        $courier->courierProfile()->create(['first_name' => 'Cora', 'last_name' => 'Rider', 'contact_number' => '09173333333', 'sex' => 'female', 'birth_date' => '1994-01-01']);
        $courier->courierLogisticsAffiliation()->create(['logistics_organization_id' => $organizationId, 'logistics_hub_id' => $hubId, 'status' => CourierAffiliationStatus::Approved]);

        return $courier;
    }

    private function order(Shop $shop): Order
    {
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $category = Category::create(['shop_category_id' => $shop->shop_category_id, 'name' => 'Products '.Str::random(4), 'slug' => 'products-'.Str::lower(Str::random(8)), 'status' => CategoryStatus::Active]);
        $product = Product::create(['shop_id' => $shop->id, 'category_id' => $category->id, 'name' => 'Product', 'slug' => 'product-'.Str::lower(Str::random(8)), 'base_sku' => 'SKU-'.Str::upper(Str::random(5)), 'price' => '100.00', 'currency' => 'PHP', 'stock_quantity' => 9, 'status' => ProductStatus::Active, 'published_at' => now()]);
        $sku = InventorySku::create(['product_id' => $product->id, 'shop_id' => $shop->id, 'code' => $product->base_sku, 'is_base' => true, 'status' => InventorySkuStatus::Active]);
        $balance = InventoryBalance::create(['inventory_sku_id' => $sku->id, 'on_hand' => 10, 'reserved' => 1]);
        $quote = CheckoutQuote::create(['customer_id' => $customer->id, 'input_payload' => [], 'request_hash' => str_repeat('a', 64), 'state_hash' => str_repeat('b', 64), 'expires_at' => now()->addHour()]);
        $batch = CheckoutBatch::create(['customer_id' => $customer->id, 'checkout_quote_id' => $quote->id, 'idempotency_key' => Str::uuid(), 'request_hash' => str_repeat('c', 64), 'currency' => 'PHP', 'placed_at' => now()]);
        $order = Order::create(['checkout_batch_id' => $batch->id, 'customer_id' => $customer->id, 'shop_id' => $shop->id, 'reference' => 'ASL-'.Str::upper(Str::random(10)), 'status' => OrderStatus::Placed, 'payment_method' => PaymentMethod::CashOnDelivery, 'payment_status' => PaymentStatus::Pending, 'currency' => 'PHP', 'merchandise_subtotal' => '100.00', 'shipping_fee' => '0.00', 'discount_total' => '0.00', 'shipping_discount_total' => '0.00', 'payable_total' => '100.00', 'placed_at' => now()]);
        $order->items()->create(['product_id' => $product->id, 'product_name' => $product->name, 'sku' => $sku->code, 'selected_options' => [], 'unit_price' => '100.00', 'quantity' => 1, 'line_subtotal' => '100.00', 'currency' => 'PHP']);
        $order->address()->create(['recipient_name' => 'Buyer', 'contact_number' => '09174444444', 'address_line_1' => '9 Buyer Street', 'barangay' => 'Lahug', 'city_municipality' => 'Cebu City', 'province' => 'Cebu', 'region' => 'Central Visayas', 'postal_code' => '6000', 'country' => 'PH']);
        $order->statusEvents()->create(['to_status' => OrderStatus::Placed, 'source' => 'customer_checkout', 'occurred_at' => now()]);
        InventoryMovement::create(['inventory_balance_id' => $balance->id, 'movement_type' => InventoryMovementType::Reserve, 'on_hand_delta' => 0, 'reserved_delta' => 1, 'resulting_on_hand' => 10, 'resulting_reserved' => 1, 'reference_type' => 'order', 'reference_id' => $order->id]);

        return $order;
    }
}
