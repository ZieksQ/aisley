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
use Database\Seeders\ProductSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerOrderMutationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ProductSeeder::class);
    }

    public function test_customer_can_cancel_a_placed_order_once_and_release_only_its_reservation(): void
    {
        [$customer, $order] = $this->placedOrder();
        $key = (string) Str::uuid();

        $response = $this->withHeader('Idempotency-Key', $key)
            ->postJson('/api/v1/customer/orders/'.$order->id.'/cancel', ['reason' => 'I no longer need this item.'])
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.status', OrderStatus::Cancelled->value)
            ->assertJsonPath('data.actions.canCancel', false)
            ->assertJsonPath('data.actions.canModify', false);

        $this->assertDatabaseHas('customer_order_cancellations', [
            'order_id' => $order->id,
            'customer_id' => $customer->id,
            'reason' => 'I no longer need this item.',
        ]);
        $this->assertDatabaseHas('inventory_balances', ['reserved' => 0]);
        $this->assertSame(1, InventoryMovement::query()->where('movement_type', 'release')->count());
        $this->assertSame(14, (int) Product::query()->whereKey($order->items()->firstOrFail()->product_id)->value('stock_quantity'));

        $this->withHeader('Idempotency-Key', $key)
            ->postJson('/api/v1/customer/orders/'.$order->id.'/cancel', ['reason' => 'I no longer need this item.'])
            ->assertOk()
            ->assertJsonPath('data.status', OrderStatus::Cancelled->value);
        $this->assertSame(1, InventoryMovement::query()->where('movement_type', 'release')->count());
    }

    public function test_customer_can_replace_the_delivery_address_without_rewriting_the_original_snapshot(): void
    {
        [$customer, $order] = $this->placedOrder();
        $replacement = $this->address($customer, 'Replacement address');

        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->patchJson('/api/v1/customer/orders/'.$order->id.'/modification', [
                'address_id' => $replacement->id,
                'expected_revision' => 1,
            ])
            ->assertOk()
            ->assertJsonPath('data.status', OrderStatus::Placed->value)
            ->assertJsonPath('data.deliveryAddress.version', 2)
            ->assertJsonPath('data.deliveryAddress.addressLine1', 'Replacement address');

        $this->assertDatabaseCount('order_addresses', 2);
        $this->assertDatabaseHas('order_addresses', [
            'order_id' => $order->id,
            'version' => 1,
            'address_line_1' => '123 Test Street',
        ]);
        $this->assertDatabaseHas('order_addresses', [
            'order_id' => $order->id,
            'version' => 2,
            'source_address_id' => $replacement->id,
            'address_line_1' => 'Replacement address',
        ]);
        $this->assertDatabaseHas('customer_order_modifications', [
            'order_id' => $order->id,
            'change_type' => 'delivery_address',
        ]);
        $this->assertSame('123 Test Street', $order->addressVersions()->where('version', 1)->value('address_line_1'));
        $this->assertFalse($order->address()->isOneOfMany());
        $this->assertSame(2, $order->fresh()->address->version);
    }

    public function test_mutations_are_customer_scoped_and_reject_stale_or_forbidden_requests(): void
    {
        [$customer, $order] = $this->placedOrder();
        $foreign = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        Sanctum::actingAs($foreign);

        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/customer/orders/'.$order->id.'/cancel')
            ->assertNotFound();

        Sanctum::actingAs($customer);
        $replacement = $this->address($customer, 'Replacement address');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->patchJson('/api/v1/customer/orders/'.$order->id.'/modification', [
                'address_id' => $replacement->id,
                'expected_revision' => 9,
            ])
            ->assertStatus(409)
            ->assertJsonPath('code', 'ORDER_REVISION_STALE');

        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/customer/orders/'.$order->id.'/cancel', ['status' => 'cancelled'])
            ->assertUnprocessable();
    }

    /** @return array{User, Order} */
    private function placedOrder(): array
    {
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        Sanctum::actingAs($customer);
        $address = $this->address($customer);
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
