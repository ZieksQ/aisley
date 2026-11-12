<?php

namespace Tests\Feature\Customer;

use App\Enums\AddressType;
use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Address;
use App\Models\InventoryMovement;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\Seller\AcceptSellerOrder;
use App\Services\Seller\RequestSellerPickup;
use Database\Seeders\ProductSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\Support\ConfiguresCheckoutFinance;
use Tests\TestCase;

class OrderPreparationTest extends TestCase
{
    use ConfiguresCheckoutFinance, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ProductSeeder::class);
        $this->configureTestCheckoutFinance();
    }

    public function test_deadline_uses_original_acceptance_and_opens_actions_at_exact_expiry(): void
    {
        [$customer, $order] = $this->acceptedOrder();
        $deadline = now()->copy()->addHours(72);
        $this->travelTo($deadline->copy()->subSecond());
        $this->getJson($this->url($order))->assertOk()->assertJsonPath('data.actions.canCancel', false)
            ->assertJsonPath('data.actions.canExtendPreparation', false);
        $this->extend($order)->assertConflict();
        $this->travelTo($deadline);
        $this->getJson($this->url($order))->assertOk()->assertJsonPath('data.preparation.overdue', true)
            ->assertJsonPath('data.actions.canCancel', true)->assertJsonPath('data.actions.canExtendPreparation', true)
            ->assertJsonPath('data.preparation.deadlineAt', $deadline->toISOString());
        $this->getJson('/api/v1/customer/orders')->assertOk()->assertJsonPath('data.0.actions.canCancel', true);
        // Acceptance stays available even outside the 25-event timeline preview.
        for ($i = 0; $i < 30; $i++) {
            $order->statusEvents()->create(['from_status' => 'seller_processing', 'to_status' => 'seller_processing', 'source' => 'test', 'occurred_at' => now()]);
        }
        $this->getJson($this->url($order))->assertOk()->assertJsonPath('data.preparation.deadlineAt', $deadline->toISOString());
    }

    public function test_extension_is_once_from_approval_and_exact_retries_never_restart_it(): void
    {
        [, $order] = $this->acceptedOrder();
        $this->travel(5)->days();
        $key = (string) Str::uuid();
        $deadline = now()->copy()->addHours(72);
        $movements = InventoryMovement::count();
        $this->extend($order, $key)->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.status', 'seller_processing')->assertJsonPath('data.preparation.extensionUsed', true)
            ->assertJsonPath('data.preparation.deadlineAt', $deadline->toISOString())
            ->assertJsonPath('data.actions.canCancel', false)->assertJsonPath('data.actions.canExtendPreparation', false);
        $this->travel(1)->hours();
        $this->extend($order, $key)->assertOk()->assertJsonPath('data.preparation.deadlineAt', $deadline->toISOString());
        $this->assertSame($movements, InventoryMovement::count());
        $this->assertDatabaseCount('order_preparation_extensions', 1);
        $this->assertSame(1, $order->statusEvents()->where('source', 'customer_preparation_extension')->count());
        $this->cancel($order)->assertConflict();
        $this->travelTo($deadline->copy()->subSecond());
        $this->cancel($order)->assertConflict();
        $this->travelTo($deadline);
        $this->extend($order)->assertConflict();
        $cancelKey = (string) Str::uuid();
        $this->cancel($order, $cancelKey)->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->cancel($order, $cancelKey)->assertOk();
        $this->assertSame(1, InventoryMovement::where('movement_type', 'release')->count());
        $this->extend($order, $key)->assertOk()->assertJsonPath('data.status', 'cancelled');
    }

    public function test_overdue_cancellation_without_extension_releases_stock_once(): void
    {
        [, $order] = $this->acceptedOrder();
        $this->travel(4)->days();
        $key = (string) Str::uuid();
        $this->cancel($order, $key)->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->cancel($order, $key)->assertOk();
        $this->assertDatabaseHas('inventory_balances', ['reserved' => 0]);
        $this->assertSame(1, InventoryMovement::where('movement_type', 'release')->count());
        $this->extend($order)->assertConflict();
    }

    public function test_readiness_or_missing_acceptance_evidence_disables_both_actions(): void
    {
        [, $order] = $this->acceptedOrder();
        $this->travel(4)->days();
        $order->update(['status' => OrderStatus::ReadyForPickup]);
        $this->extend($order)->assertConflict();
        $this->cancel($order)->assertConflict();
        $order->update(['status' => OrderStatus::SellerProcessing]);
        $order->statusEvents()->where('source', 'seller_order_acceptance')->update(['source' => 'unknown_history']);
        $this->getJson($this->url($order))->assertOk()->assertJsonPath('data.preparation.acceptedAt', null)
            ->assertJsonPath('data.actions.canCancel', false)->assertJsonPath('data.actions.canExtendPreparation', false);
        $this->extend($order)->assertConflict();
        $this->cancel($order)->assertConflict();
    }

    public function test_late_pickup_readiness_closes_actions_and_cancelled_orders_reject_bulk_pickup(): void
    {
        [$customer, $order] = $this->acceptedOrder();
        $seller = $order->shop->seller;
        $seller->addresses()->update(['latitude' => 14.5, 'longitude' => 121.1]);
        $this->travel(4)->days();
        $request = app(RequestSellerPickup::class)->handle(
            $seller, [$order->id], $seller->addresses()->firstOrFail()->id,
            $order->selected_logistics_organization_id, (string) Str::uuid(),
        );
        $this->assertSame(OrderStatus::ReadyForPickup, $order->fresh()->status);
        $this->cancel($order)->assertConflict();
        $this->extend($order)->assertConflict();
        $this->getJson($this->url($order))->assertOk()->assertJsonPath('data.preparation.active', false);

        [, $other] = $this->acceptedOrder();
        $other->update(['customer_id' => $customer->id]);
        Sanctum::actingAs($customer);
        $this->travel(4)->days();
        $this->cancel($other)->assertOk();
        $this->app['auth']->forgetGuards();
        $this->actingAs($seller, 'web');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/seller/orders/pickup-requests', [
            'order_ids' => [$order->id, $other->id],
            'pickup_address_id' => $seller->addresses()->firstOrFail()->id,
            'logistics_organization_id' => $order->selected_logistics_organization_id,
        ])->assertConflict();
        $this->assertDatabaseCount('seller_pickup_requests', 1);
        $this->assertDatabaseCount('waybills', 1);
    }

    public function test_overdue_orders_cannot_modify_addresses_or_bypass_payment_guards(): void
    {
        [$customer, $order] = $this->acceptedOrder();
        $this->travel(4)->days();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->patchJson($this->url($order).'/modification', [
            'address_id' => $this->address($customer)->id,
        ])->assertConflict();
        $order->update(['payment_status' => 'paid']);
        $this->extend($order)->assertConflict();
        $this->cancel($order)->assertConflict();
    }

    public function test_extension_validates_keys_payload_and_customer_ownership(): void
    {
        [$customer, $order] = $this->acceptedOrder();
        $this->travel(4)->days();
        $this->withHeader('Idempotency-Key', 'invalid')->postJson($this->url($order).'/preparation-extension')->assertUnprocessable();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson($this->url($order).'/preparation-extension', ['hours' => 100])->assertUnprocessable();
        Sanctum::actingAs(User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]));
        $this->extend($order)->assertNotFound();
        Sanctum::actingAs(User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]));
        $this->extend($order)->assertForbidden();
        Sanctum::actingAs($customer);
        $key = (string) Str::uuid();
        $this->extend($order, $key)->assertOk();
        [, $other] = $this->acceptedOrder();
        $other->update(['customer_id' => $customer->id]);
        Sanctum::actingAs($customer);
        $this->extend($other, $key)->assertConflict()->assertJsonPath('code', 'IDEMPOTENCY_KEY_REUSED');
    }

    private function acceptedOrder(): array
    {
        $this->travelTo(now()->startOfSecond());
        [$customer, $order] = $this->placedOrder(true);
        app(AcceptSellerOrder::class)->handle($order->shop->seller, $order->id, (string) Str::uuid());

        return [$customer, $order->fresh()];
    }

    private function url(Order $order): string
    {
        return '/api/v1/customer/orders/'.$order->id;
    }

    private function extend(Order $order, ?string $key = null): TestResponse
    {
        return $this->withHeader('Idempotency-Key', $key ?? (string) Str::uuid())->postJson($this->url($order).'/preparation-extension');
    }

    private function cancel(Order $order, ?string $key = null): TestResponse
    {
        return $this->withHeader('Idempotency-Key', $key ?? (string) Str::uuid())->postJson($this->url($order).'/cancel');
    }

    /** @return array{User, Order} */
    private function placedOrder(bool $pinned = false): array
    {
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        Sanctum::actingAs($customer);
        $address = $this->address($customer);
        if ($pinned) {
            $address->update(['latitude' => 14.5, 'longitude' => 121.1]);
        }
        $product = Product::query()->where('slug', 'compact-everyday-camera')->firstOrFail();
        $payload = [
            'mode' => 'buy_now',
            'buy_now' => ['product_id' => $product->id, 'variant_id' => null, 'quantity' => 1],
            'address_id' => $address->id,
            'payment_method' => 'cod',
            'vouchers' => [],
        ];
        $quote = $this->postJson('/api/v1/customer/checkout/quote', $payload)->assertOk()->json('data.quoteId');
        $batch = $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/customer/checkout/place', [...$payload, 'quote_id' => $quote])
            ->assertOk()
            ->json('data');

        return [$customer, Order::query()->whereKey($batch['orders'][0]['id'])->firstOrFail()];
    }

    private function address(User $customer, string $line = '123 Test Street'): Address
    {
        return Address::create([
            'user_id' => $customer->id,
            'type' => AddressType::Shipping,
            'label' => 'Home',
            'recipient_name' => 'Ada Buyer',
            'contact_number' => '09171234567',
            'address_line_1' => $line,
            'barangay' => 'San Antonio',
            'city_municipality' => 'Makati City',
            'province' => 'Metro Manila',
            'region' => 'NCR',
            'postal_code' => '1203',
            'country' => 'Philippines',
        ]);
    }
}
