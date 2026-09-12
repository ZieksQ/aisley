<?php

namespace Tests\Feature\Logistics;

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

class FinalMileFulfillmentTest extends TestCase
{
    use RefreshDatabase;

    public function test_final_mile_moves_from_hub_to_delivered_with_logistics_validation(): void
    {
        [$seller, $shop] = $this->sellerShop();
        $order = $this->order($shop);
        $order->update(['status' => OrderStatus::SellerProcessing]);
        [$logistics, $organization, $hub] = $this->logistics();
        $courier = $this->courier($organization->id, $hub->id);
        $pickupAddress = $seller->addresses()->sole();
        $pickup = $this->actingAs($seller)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/seller/orders/pickup-requests', [
            'order_ids' => [$order->id], 'pickup_address_id' => $pickupAddress->id, 'logistics_organization_id' => $organization->id,
        ])->assertOk()->json('data');
        $schedule = $this->actingAs($logistics)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/pickup-schedules', [
            'order_ids' => [$order->id], 'courier_id' => $courier->id, 'starts_at' => now()->addHours(3)->toISOString(), 'ends_at' => now()->addHours(4)->toISOString(),
        ])->assertCreated()->json('data');
        $first = $this->actingAs($courier)->getJson('/api/v1/courier/first-mile-tasks')->assertOk()->json('data.0');
        $this->postJson("/api/v1/courier/first-mile-tasks/{$first['id']}/accept")->assertOk();
        $qr = 'AISLEY:WB:1:'.$pickup['waybills'][0]['reference'];
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/courier/first-mile-tasks/{$first['id']}/pickup", ['identifier_type' => 'qr', 'identifier' => $qr])->assertOk();

        $record = $this->actingAs($logistics)->getJson('/api/v1/logistics/update-status/records/'.$pickup['waybills'][0]['reference'])->assertOk()->json('data');
        $this->assertSame('picked_up_from_seller', $record['status']);
        $revision = $record['revision'];
        foreach (['received_at_hub', 'sorted_at_hub', 'dispatched_from_hub'] as $state) {
            $record = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/update-status/transitions', [
                'reference' => $pickup['waybills'][0]['reference'], 'target_state' => $state, 'expected_revision' => $revision,
            ])->assertOk()->json('data');
            $revision = $record['revision'];
        }
        $final = collect($record['tasks'])->firstWhere('leg', 'final_mile');
        $this->assertSame('delivery_assigned', $final['status']);

        $this->actingAs($logistics)->getJson("/api/v1/logistics/deploy-rider/tasks/{$final['task_id']}/candidates")->assertOk()->assertJsonPath('data.0.courier_id', $courier->id);
        $offer = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/logistics/deploy-rider/tasks/{$final['task_id']}/offers", [
            'courier_id' => $courier->id, 'expected_task_revision' => $final['revision'],
        ])->assertCreated()->json('data');
        $final = $offer['task'];
        $this->actingAs($courier)->getJson("/api/v1/courier/tasks/{$final['task_id']}/delivery")->assertStatus(409)->assertJsonPath('code', 'TASK_NOT_ACCEPTED');
        $rejected = $this->actingAs($courier)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/courier/final-mile-tasks/{$final['task_id']}/reject", [
            'reason' => 'Unavailable for this route',
        ])->assertOk()->json('data');
        $this->assertSame('rejected', $rejected['status']);
        $this->assertNull($rejected['courier_id']);
        $this->assertSame('rejected', $rejected['offer']['status']);
        $offer = $this->actingAs($logistics)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/logistics/deploy-rider/tasks/{$final['task_id']}/offers", [
            'courier_id' => $courier->id, 'expected_task_revision' => $rejected['revision'],
        ])->assertCreated()->json('data');
        $this->assertSame(2, $offer['offer']['sequence']);
        $final = $offer['task'];
        $this->actingAs($courier)->postJson("/api/v1/courier/final-mile-tasks/{$final['task_id']}/accept")->assertOk();
        $final = $this->actingAs($courier)->getJson('/api/v1/courier/final-mile-tasks')->assertOk()->json('data.0');
        $this->actingAs($courier)->getJson("/api/v1/courier/tasks/{$final['task_id']}/delivery")
            ->assertOk()
            ->assertJsonPath('data.status', 'delivery_accepted')
            ->assertJsonPath('data.destination.address_line_1', '9 Buyer Street')
            ->assertJsonPath('data.destination.contact_number', '09174444444');
        $pickupEvidence = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/courier/final-mile-tasks/{$final['task_id']}/pickup", [
            'identifier_type' => 'qr', 'identifier' => $qr, 'expected_revision' => $final['revision'],
        ])->assertStatus(202)->json('data');
        $record = $this->actingAs($logistics)->getJson('/api/v1/logistics/update-status/records/'.$pickup['waybills'][0]['reference'])->json('data');
        $record = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/update-status/transitions', [
            'reference' => $pickup['waybills'][0]['reference'], 'target_state' => 'picked_up_from_hub', 'expected_revision' => $record['revision'], 'evidence_id' => $pickupEvidence['evidence_id'],
        ])->assertOk()->json('data');
        $final = collect($record['tasks'])->firstWhere('leg', 'final_mile');

        foreach (['in_transit', 'out_for_delivery'] as $state) {
            $final = $this->actingAs($courier)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/courier/final-mile-tasks/{$final['task_id']}/status", ['target_state' => $state, 'expected_revision' => $final['revision']])->assertOk()->json('data');
        }
        $proof = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/courier/tasks/{$final['task_id']}/proof-of-delivery", ['identifier_type' => 'qr', 'identifier' => $qr, 'expected_revision' => $final['revision']])->assertStatus(202)->json('data');
        $intent = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/courier/tasks/{$final['task_id']}/completion", ['expected_revision' => $final['revision'], 'evidence_id' => $proof['proof_id'], 'confirmed' => true])->assertStatus(202)->json('data');
        $this->assertSame('awaiting_validation', $intent['completion_status']);
        $record = $this->actingAs($logistics)->getJson('/api/v1/logistics/update-status/records/'.$pickup['waybills'][0]['reference'])->json('data');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/update-status/transitions', [
            'reference' => $pickup['waybills'][0]['reference'], 'target_state' => 'delivered', 'expected_revision' => $record['revision'], 'evidence_id' => $proof['proof_id'],
        ])->assertOk()->assertJsonPath('data.status', 'delivered');
        $this->assertSame(OrderStatus::Delivered, $order->fresh()->status);
        $this->assertDatabaseHas('shipment_events', ['event_type' => 'delivery_completed', 'performing_courier_id' => $courier->id, 'recorded_by_logistics_id' => $logistics->id]);
        $this->actingAs($courier)->getJson('/api/v1/courier/delivery-history')->assertOk()->assertJsonPath('data.0.status', 'delivered');
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
