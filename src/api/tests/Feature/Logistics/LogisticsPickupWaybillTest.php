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
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class LogisticsPickupWaybillTest extends TestCase
{
    use RefreshDatabase;

    public function test_options_rank_exact_psgc_matches_and_truthfully_fall_back_without_distance(): void
    {
        [$seller] = $this->sellerShop();
        [, $near] = $this->logistics('Near Logistics', 'Manila', 'Metro Manila');
        [, $province] = $this->logistics('Province Logistics', 'Makati City', 'Metro Manila');
        config()->set('services.geoapify.server_key', null);

        $this->actingAs($seller)->getJson('/api/v1/seller/logistics-options')
            ->assertOk()
            ->assertJsonPath('data.0.id', $near->id)
            ->assertJsonPath('data.0.match_tier', 'same_city')
            ->assertJsonPath('data.0.recommended', false)
            ->assertJsonPath('data.0.distance_km', null)
            ->assertJsonPath('data.0.status', 'unavailable')
            ->assertJsonPath('data.1.id', $province->id)
            ->assertJsonPath('meta.attribution.0', 'Geoapify');
    }

    public function test_geoapify_road_distance_breaks_an_exact_match_tie(): void
    {
        [$seller] = $this->sellerShop(true);
        [, $far] = $this->logistics('A Far Logistics', 'Manila', 'Metro Manila', true);
        [, $near] = $this->logistics('Z Near Logistics', 'Manila', 'Metro Manila', true, 14.61, 121.02);
        config()->set('services.geoapify.server_key', 'server-secret');
        Http::fake(['api.geoapify.com/*' => Http::response(['sources_to_targets' => [[['distance' => 12500], ['distance' => 3200]]]])]);

        $this->actingAs($seller)->getJson('/api/v1/seller/logistics-options')
            ->assertOk()->assertJsonPath('data.0.id', $near->id)->assertJsonPath('data.0.distance_km', 3.2)
            ->assertJsonPath('data.0.recommended', true)->assertJsonPath('data.1.id', $far->id);
        Http::assertSent(fn ($request) => $request->url() === 'https://api.geoapify.com/v1/routematrix?apiKey=server-secret'
            && $request['mode'] === 'drive' && count($request['sources']) === 1 && count($request['targets']) === 2);
    }

    public function test_pickup_creates_immutable_waybill_and_notifies_only_selected_logistics(): void
    {
        [$seller, $shop] = $this->sellerShop();
        $order = $this->order($shop);
        $order->update(['status' => OrderStatus::SellerProcessing]);
        [$selectedUser, $selected] = $this->logistics('Selected Logistics', 'Manila', 'Metro Manila');
        [$otherUser] = $this->logistics('Other Logistics', 'Quezon City', 'Metro Manila');
        $key = (string) Str::uuid();

        $response = $this->actingAs($seller)->withHeader('Idempotency-Key', $key)->postJson('/api/v1/seller/orders/pickup-requests', [
            'order_ids' => [$order->id], 'logistics_organization_id' => $selected->id,
        ])->assertOk()->assertJsonPath('data.logistics_organization_id', $selected->id)->assertJsonCount(1, 'data.waybills');
        $waybillId = $response->json('data.waybills.0.id');
        $pickupId = $response->json('data.id');

        $this->withHeader('Idempotency-Key', $key)->postJson('/api/v1/seller/orders/pickup-requests', [
            'order_ids' => [$order->id], 'logistics_organization_id' => $selected->id,
        ])->assertOk()->assertJsonPath('data.waybills.0.id', $waybillId);
        $this->assertDatabaseCount('waybills', 1);
        $this->assertDatabaseHas('notifications', ['notifiable_id' => $selectedUser->id, 'type' => 'logistics-pickup.requested']);
        $this->assertDatabaseMissing('notifications', ['notifiable_id' => $otherUser->id, 'type' => 'logistics-pickup.requested']);

        $pdf = $this->get("/api/v1/seller/orders/{$order->id}/waybill");
        $pdf->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringContainsString('private', (string) $pdf->headers->get('Cache-Control'));
        $this->assertStringContainsString('no-store', (string) $pdf->headers->get('Cache-Control'));
        $this->assertStringStartsWith('%PDF-', (string) $pdf->getContent());
        $this->assertDatabaseCount('waybill_access_events', 1);
        $this->get("/api/v1/seller/pickup-requests/{$pickupId}/waybills.pdf")->assertOk();
        $this->assertDatabaseCount('waybill_access_events', 2);
        $this->assertSame(OrderStatus::ReadyForPickup, $order->fresh()->status);
        $this->assertSame(1, InventoryBalance::firstOrFail()->reserved);
    }

    public function test_logistics_schedule_is_tenant_scoped_and_courier_can_accept_and_resolve_only_assigned_waybill(): void
    {
        [$seller, $shop] = $this->sellerShop();
        $order = $this->order($shop);
        $order->update(['status' => OrderStatus::SellerProcessing]);
        [$logistics, $organization, $hub] = $this->logistics('Assigned Logistics', 'Manila', 'Metro Manila');
        [$foreign] = $this->logistics('Foreign Logistics', 'Cebu City', 'Cebu');
        $courier = $this->courier($organization->id, $hub->id);
        $pickup = $this->actingAs($seller)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/seller/orders/pickup-requests', ['order_ids' => [$order->id], 'logistics_organization_id' => $organization->id])->json('data');

        $this->actingAs($foreign)->getJson("/api/v1/logistics/pickups/{$pickup['id']}")->assertNotFound();
        $this->actingAs($logistics)->getJson('/api/v1/logistics/pickup-couriers')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $courier->id);
        $this->actingAs($logistics)->getJson('/api/v1/logistics/pickups?search='.urlencode($order->reference))
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $pickup['id']);
        $this->getJson("/api/v1/logistics/pickups/{$pickup['id']}/waybills")
            ->assertOk()->assertJsonPath('data.0.reference', $pickup['waybills'][0]['reference']);
        $this->get("/api/v1/logistics/waybills/{$pickup['waybills'][0]['id']}.pdf")
            ->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->actingAs($foreign)->get("/api/v1/logistics/waybills/{$pickup['waybills'][0]['id']}.pdf")->assertNotFound();
        $schedule = $this->actingAs($logistics)->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/pickup-schedules', [
            'order_ids' => [$order->id], 'courier_id' => $courier->id,
            'starts_at' => now()->addHours(3)->toISOString(), 'ends_at' => now()->addHours(4)->toISOString(),
        ])->assertCreated()->assertJsonPath('data.order_ids.0', $order->id)->json('data');
        $this->assertSame(OrderStatus::ReadyForPickup, $order->fresh()->status);
        $this->assertDatabaseCount('pickup_schedule_reminders', 1);

        $schedule = $this->patchJson("/api/v1/logistics/pickup-schedules/{$schedule['id']}", [
            'expected_revision' => 1, 'reason' => 'Move the future collection window.',
            'starts_at' => now()->addHours(4)->toISOString(), 'ends_at' => now()->addHours(5)->toISOString(),
        ])->assertOk()->assertJsonPath('data.revision', 2)->json('data');
        $this->assertDatabaseHas('pickup_schedule_reminders', ['pickup_schedule_id' => $schedule['id'], 'schedule_revision' => 1, 'status' => 'superseded']);
        $this->assertDatabaseHas('pickup_schedule_reminders', ['pickup_schedule_id' => $schedule['id'], 'schedule_revision' => 2, 'status' => 'pending']);

        $task = $this->actingAs($courier)->getJson('/api/v1/courier/first-mile-tasks')->assertOk()->assertJsonCount(1, 'data')->json('data.0');
        $this->postJson("/api/v1/courier/first-mile-tasks/{$task['id']}/accept")->assertOk()->assertJsonPath('data.status', 'accepted');
        $payload = 'AISLEY:WB:1:'.$pickup['waybills'][0]['reference'];
        $this->postJson('/api/v1/courier/waybills/resolve', ['payload' => $payload])->assertOk()->assertJsonPath('data.matched', true)->assertJsonPath('data.task.id', $task['id']);

        $foreignCourier = $this->courier($foreign->logisticsOrganization->id, $foreign->logisticsOrganization->hub->id);
        $this->actingAs($foreignCourier)->postJson('/api/v1/courier/waybills/resolve', ['payload' => $payload])->assertNotFound();
        $this->actingAs($logistics)->postJson("/api/v1/logistics/pickup-schedules/{$schedule['id']}/cancel", ['expected_revision' => 2, 'reason' => 'Seller requested a future reschedule.'])->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->assertDatabaseHas('pickup_schedule_reminders', ['pickup_schedule_id' => $schedule['id'], 'status' => 'suppressed']);
    }

    private function sellerShop(bool $coordinates = false): array
    {
        $seller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
        $category = ShopCategory::create(['name' => 'General '.Str::random(5), 'slug' => 'general-'.Str::lower(Str::random(8)), 'status' => CategoryStatus::Active]);
        $shop = Shop::create(['seller_id' => $seller->id, 'shop_category_id' => $category->id, 'name' => 'Seller Shop', 'slug' => 'seller-'.Str::lower(Str::random(8)), 'status' => ShopStatus::Active, 'contact_number' => '09171111111']);
        $seller->addresses()->create(['type' => AddressType::Both, 'label' => 'Pickup', 'recipient_name' => 'Seller', 'contact_number' => '09171111111', 'address_line_1' => '1 Seller Road', 'barangay' => 'Ermita', 'city_municipality' => 'Manila', 'province' => 'Metro Manila', 'region' => 'NCR', 'postal_code' => '1000', 'country' => 'PH', 'latitude' => $coordinates ? 14.60 : null, 'longitude' => $coordinates ? 120.98 : null, 'is_default' => true]);

        return [$seller, $shop];
    }

    private function logistics(string $name, string $city, string $province, bool $coordinates = false, float $latitude = 14.65, float $longitude = 121.03): array
    {
        $user = User::factory()->create(['role' => UserRole::Logistics, 'status' => UserStatus::Active]);
        $address = $user->addresses()->create(['type' => AddressType::Both, 'label' => 'Hub', 'recipient_name' => 'Operator', 'contact_number' => '09172222222', 'address_line_1' => '1 Hub Road', 'barangay' => 'Poblacion', 'city_municipality' => $city, 'province' => $province, 'region' => 'NCR', 'postal_code' => '1000', 'country' => 'PH', 'latitude' => $coordinates ? $latitude : null, 'longitude' => $coordinates ? $longitude : null, 'is_default' => true]);
        $organization = $user->logisticsOrganization()->create(['business_name' => $name]);
        $hub = $organization->hub()->create(['address_id' => $address->id, 'name' => $name.' Hub']);

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
        $product = Product::create(['shop_id' => $shop->id, 'category_id' => $category->id, 'name' => 'Private Product Name', 'slug' => 'private-'.Str::lower(Str::random(8)), 'base_sku' => 'SKU-'.Str::upper(Str::random(5)), 'price' => '100.00', 'currency' => 'PHP', 'stock_quantity' => 9, 'status' => ProductStatus::Active, 'published_at' => now()]);
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
