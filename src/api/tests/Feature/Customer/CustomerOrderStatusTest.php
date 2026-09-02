<?php

namespace Tests\Feature\Customer;

use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\CheckoutBatch;
use App\Models\CheckoutQuote;
use App\Models\Order;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerOrderStatusTest extends TestCase
{
    use RefreshDatabase;

    public function test_order_endpoints_require_an_active_customer(): void
    {
        $this->getJson('/api/v1/customer/orders')->assertUnauthorized();

        Sanctum::actingAs(User::factory()->create([
            'role' => UserRole::Seller,
            'status' => UserStatus::Active,
        ]));
        $this->getJson('/api/v1/customer/orders')->assertForbidden()
            ->assertJsonPath('code', 'FORBIDDEN_ROLE');

        Sanctum::actingAs(User::factory()->create([
            'role' => UserRole::Customer,
            'status' => UserStatus::Pending,
        ]));
        $this->getJson('/api/v1/customer/orders')->assertForbidden()
            ->assertJsonPath('code', 'ACCOUNT_PENDING_APPROVAL');
    }

    public function test_all_is_the_default_and_groups_filter_the_customer_collection_server_side(): void
    {
        $customer = $this->customer();
        $shop = $this->shop();
        $statuses = [
            OrderStatus::PendingPayment,
            OrderStatus::Placed,
            OrderStatus::SellerProcessing,
            OrderStatus::ReadyForPickup,
            OrderStatus::Assigned,
            OrderStatus::PickedUp,
            OrderStatus::InTransit,
            OrderStatus::OutForDelivery,
            OrderStatus::Delivered,
            OrderStatus::Cancelled,
            OrderStatus::Rejected,
            OrderStatus::DeliveryFailed,
            OrderStatus::ReturnRequested,
            OrderStatus::Returned,
        ];

        foreach ($statuses as $index => $status) {
            $this->order($customer, $shop, $status, now()->subMinutes(30 - $index));
        }

        $all = $this->getJson('/api/v1/customer/orders?per_page=50')
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonCount(14, 'data')
            ->assertJsonPath('filters.selected', null)
            ->assertJsonPath('filters.tabs.0.label', 'All')
            ->assertJsonPath('filters.tabs.1.value', 'to_pay')
            ->assertJsonPath('filters.tabs.2.value', 'to_prepare')
            ->assertJsonPath('filters.tabs.3.value', 'to_ship')
            ->assertJsonPath('filters.tabs.4.value', 'out_for_delivery')
            ->assertJsonPath('filters.tabs.5.value', 'completed')
            ->assertJsonPath('filters.tabs.6.value', 'cancelled_issue')
            ->json('data');

        $this->assertSame(OrderStatus::Returned->value, $all[0]['status']);
        $this->assertSame('20.00', $all[0]['totals']['payable']);

        $expected = [
            'to_pay' => ['pending_payment'],
            'to_prepare' => ['placed', 'seller_processing', 'ready_for_pickup'],
            'to_ship' => ['assigned', 'picked_up', 'in_transit'],
            'out_for_delivery' => ['out_for_delivery'],
            'completed' => ['delivered'],
            'cancelled_issue' => ['cancelled', 'rejected', 'delivery_failed', 'return_requested', 'returned'],
        ];

        foreach ($expected as $group => $groupStatuses) {
            $response = $this->getJson('/api/v1/customer/orders?group='.$group.'&per_page=50')
                ->assertOk()
                ->assertJsonPath('filters.selected', $group)
                ->json('data');

            $this->assertEqualsCanonicalizing($groupStatuses, array_column($response, 'status'));
            $this->assertSame([$group], array_values(array_unique(array_column($response, 'group'))));
        }

        $this->getJson('/api/v1/customer/orders?group=placed')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('group');
        $this->getJson('/api/v1/customer/orders?per_page=51')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('per_page');
    }

    public function test_list_is_customer_scoped_paginated_and_sorted_by_latest_tracking_activity(): void
    {
        $customer = $this->customer();
        $otherCustomer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $shop = $this->shop();
        $olderOrderWithNewActivity = $this->order($customer, $shop, OrderStatus::Assigned, now()->subDay());
        $newerOrder = $this->order($customer, $shop, OrderStatus::Placed, now()->subHour());
        $this->order($otherCustomer, $shop, OrderStatus::Delivered, now());

        $olderOrderWithNewActivity->statusEvents()->create([
            'from_status' => OrderStatus::ReadyForPickup,
            'to_status' => OrderStatus::Assigned,
            'source' => 'logistics_receipt',
            'occurred_at' => now()->subMinute(),
        ]);

        $response = $this->getJson('/api/v1/customer/orders?per_page=1')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('meta.per_page', 1)
            ->json();

        $this->assertSame($olderOrderWithNewActivity->id, $response['data'][0]['id']);
        $this->assertNotSame($newerOrder->id, $response['data'][0]['id']);
    }

    public function test_owned_detail_returns_safe_snapshots_timeline_map_state_and_actions(): void
    {
        $customer = $this->customer();
        $order = $this->order($customer, $this->shop(), OrderStatus::Assigned, now()->subHours(2));
        $eventTime = Carbon::parse('2026-08-31T04:05:06Z');
        $order->statusEvents()->create([
            'from_status' => OrderStatus::ReadyForPickup,
            'to_status' => OrderStatus::Assigned,
            'source' => 'internal_scanner_employee_123',
            'public_metadata' => [
                'label' => 'Received at sorting hub',
                'event_type' => 'hub_received',
                'hub_label' => 'Makati Hub',
                'city_label' => 'Makati City',
                'private_note' => 'Do not expose this note',
                'employee_id' => 'employee-123',
            ],
            'occurred_at' => $eventTime,
        ]);

        $response = $this->getJson('/api/v1/customer/orders/'.$order->id)
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.reference', $order->reference)
            ->assertJsonPath('data.group', 'to_ship')
            ->assertJsonPath('data.groupLabel', 'To Ship')
            ->assertJsonPath('data.items.0.productName', 'Snapshot Product')
            ->assertJsonPath('data.deliveryAddress.recipientName', 'Ada Buyer')
            ->assertJsonPath('data.payment.method', 'cod')
            ->assertJsonPath('data.totals.payable', '20.00')
            ->assertJsonPath('data.timeline.1.label', 'Parcel received by logistics')
            ->assertJsonPath('data.map.available', false)
            ->assertJsonPath('data.map.state', 'unavailable')
            ->assertJsonPath('data.map.currentPosition', null)
            ->assertJsonPath('data.actions.canCancel', false)
            ->assertJsonPath('data.actions.canModify', false);

        $payload = $response->getContent();
        $this->assertStringNotContainsString('private_note', $payload);
        $this->assertStringNotContainsString('Do not expose this note', $payload);
        $this->assertStringNotContainsString('employee-123', $payload);
        $this->assertStringNotContainsString('internal_scanner_employee_123', $payload);
        $this->assertStringNotContainsString('latitude', $payload);
        $this->assertStringNotContainsString('longitude', $payload);
    }

    public function test_foreign_orders_are_not_disclosed_by_detail_or_tracking(): void
    {
        $customer = $this->customer();
        $foreignCustomer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $foreignOrder = $this->order($foreignCustomer, $this->shop(), OrderStatus::InTransit, now());

        $this->getJson('/api/v1/customer/orders/'.$foreignOrder->id)->assertNotFound();
        $this->getJson('/api/v1/customer/orders/'.$foreignOrder->id.'/tracking')->assertNotFound();
        $this->assertNotSame($customer->id, $foreignOrder->customer_id);
    }

    public function test_tracking_is_paginated_in_chronological_order_and_allow_lists_public_metadata(): void
    {
        $customer = $this->customer();
        $order = $this->order($customer, $this->shop(), OrderStatus::InTransit, now()->subHours(3));
        $order->statusEvents()->create([
            'from_status' => OrderStatus::Assigned,
            'to_status' => OrderStatus::PickedUp,
            'source' => 'courier_scan',
            'public_metadata' => ['label' => 'Pickup confirmed', 'city_label' => 'Taguig City'],
            'occurred_at' => now()->subHours(2),
        ]);
        $order->statusEvents()->create([
            'from_status' => OrderStatus::PickedUp,
            'to_status' => OrderStatus::InTransit,
            'source' => 'hub_transfer',
            'public_metadata' => ['label' => 'Departed hub'],
            'occurred_at' => now()->subHour(),
        ]);

        $this->getJson('/api/v1/customer/orders/'.$order->id.'/tracking?per_page=2')
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.status', 'in_transit')
            ->assertJsonPath('data.1.status', 'picked_up')
            ->assertJsonPath('data.1.location.city', 'Taguig City')
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('meta.last_page', 2);
    }

    private function customer(): User
    {
        $customer = User::factory()->create([
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ]);
        Sanctum::actingAs($customer);

        return $customer;
    }

    private function shop(): Shop
    {
        $seller = User::factory()->create([
            'role' => UserRole::Seller,
            'status' => UserStatus::Active,
        ]);

        return Shop::create([
            'seller_id' => $seller->id,
            'name' => 'Order Test Shop',
            'slug' => 'order-test-shop-'.Str::lower(Str::random(6)),
            'status' => ShopStatus::Active,
        ]);
    }

    private function order(User $customer, Shop $shop, OrderStatus $status, Carbon $activityAt): Order
    {
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
            'placed_at' => $activityAt,
        ]);
        $order = Order::create([
            'checkout_batch_id' => $batch->id,
            'customer_id' => $customer->id,
            'shop_id' => $shop->id,
            'reference' => 'ASL-TEST-'.Str::upper(Str::random(10)),
            'status' => $status,
            'payment_method' => PaymentMethod::CashOnDelivery,
            'payment_status' => PaymentStatus::Pending,
            'currency' => 'PHP',
            'merchandise_subtotal' => '15.00',
            'shipping_fee' => '5.00',
            'discount_total' => '0.00',
            'shipping_discount_total' => '0.00',
            'payable_total' => '20.00',
            'placed_at' => $activityAt,
        ]);
        $order->items()->create([
            'product_name' => 'Snapshot Product',
            'variant_name' => 'Color: Purple',
            'sku' => 'SNAPSHOT-SKU',
            'selected_options' => [['group' => 'Color', 'value' => 'Purple']],
            'unit_price' => '15.00',
            'quantity' => 1,
            'line_subtotal' => '15.00',
            'currency' => 'PHP',
        ]);
        $order->address()->create([
            'recipient_name' => 'Ada Buyer',
            'contact_number' => '09171234567',
            'address_line_1' => '123 Test Street',
            'barangay' => 'San Antonio',
            'city_municipality' => 'Makati City',
            'province' => 'Metro Manila',
            'region' => 'NCR',
            'postal_code' => '1203',
            'country' => 'Philippines',
            'latitude' => '14.5547000',
            'longitude' => '121.0244000',
        ]);
        $order->statusEvents()->create([
            'from_status' => null,
            'to_status' => $status,
            'source' => 'test_setup',
            'occurred_at' => $activityAt,
        ]);

        return $order;
    }
}
