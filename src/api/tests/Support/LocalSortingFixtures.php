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
use App\Models\FirstMileTask;
use App\Models\InventoryBalance;
use App\Models\InventoryMovement;
use App\Models\InventorySku;
use App\Models\Order;
use App\Models\Product;
use App\Models\Shop;
use App\Models\ShopCategory;
use App\Models\User;
use Illuminate\Support\Str;

trait LocalSortingFixtures
{
    private function dispatchAssignment(array $record): array
    {
        return ['shipment_id' => $record['shipment_id'], 'expected_revision' => $record['revision'], 'lane_id' => $record['sorting_lane']['id'] ?? null, 'lane_revision' => $record['sorting_lane']['revision'] ?? null];
    }

    private function receivedParcels(int $count): array
    {
        [$seller, $shop] = $this->sellerShop();
        [$logistics, $organization, $hub] = $this->logistics();
        $courier = $this->courier($organization->id, $hub->id);
        $orders = collect(range(1, $count))->map(function () use ($shop) {
            $order = $this->order($shop);
            $order->update(['status' => OrderStatus::SellerProcessing]);

            return $order;
        });
        $pickup = $this->actingAs($seller)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/seller/orders/pickup-requests', ['order_ids' => $orders->pluck('id')->all(), 'pickup_address_id' => $seller->addresses()->sole()->id, 'logistics_organization_id' => $organization->id])->assertOk()->json('data');
        $this->actingAs($logistics)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/pickup-schedules', ['order_ids' => $orders->pluck('id')->all(), 'courier_id' => $courier->id, 'starts_at' => now()->addHours(3)->toISOString(), 'ends_at' => now()->addHours(4)->toISOString()])->assertCreated();
        $tasks = $this->actingAs($courier)->getJson('/api/v1/courier/first-mile-tasks')->assertOk()->json('data');
        foreach ($tasks as $task) {
            $this->postJson("/api/v1/courier/first-mile-tasks/{$task['id']}/accept")->assertOk();
            $waybill = FirstMileTask::findOrFail($task['id'])->waybill;
            $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/courier/first-mile-tasks/{$task['id']}/pickup", ['identifier_type' => 'qr', 'identifier' => 'AISLEY:WB:1:'.$waybill->reference])->assertOk();
        }
        $references = array_column($pickup['waybills'], 'reference');
        $this->actingAs($logistics)->postJson('/api/v1/logistics/receiving/batches', ['receipts' => array_map(fn ($reference) => ['client_id' => (string) Str::uuid(), 'reference' => $reference, 'scanned_at' => now()->toISOString()], $references)])->assertOk()->assertJsonPath('summary.received', $count);

        return [$logistics, $courier, $references];
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
