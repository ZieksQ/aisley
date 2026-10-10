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
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\ConfiguresCheckoutFinance;
use Tests\TestCase;

class CustomerOrderMutationTest extends TestCase
{
    use ConfiguresCheckoutFinance, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ProductSeeder::class);
        $this->configureTestCheckoutFinance();
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

    public function test_customer_can_correct_delivery_contact_without_rewriting_the_original_snapshot_or_pricing(): void
    {
        [$customer, $order] = $this->placedOrder();
        $replacement = $this->address($customer);
        $replacement->update(['recipient_name' => 'Ada Corrected', 'contact_number' => '09179876543']);
        $pricing = $order->pricingSnapshot->getAttributes();
        $key = (string) Str::uuid();

        $this->withHeader('Idempotency-Key', $key)
            ->patchJson('/api/v1/customer/orders/'.$order->id.'/modification', [
                'address_id' => $replacement->id,
                'expected_revision' => 1,
            ])
            ->assertOk()
            ->assertJsonPath('data.status', OrderStatus::Placed->value)
            ->assertJsonPath('data.deliveryAddress.version', 2)
            ->assertJsonPath('data.deliveryAddress.addressLine1', '123 Test Street')
            ->assertJsonPath('data.deliveryAddress.recipientName', 'Ada Corrected')
            ->assertJsonPath('data.deliveryAddress.contactNumber', '09179876543')
            ->assertJsonPath('data.deliveryAddress.latitude', null)
            ->assertJsonPath('data.deliveryAddress.longitude', null);

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
            'address_line_1' => '123 Test Street',
            'recipient_name' => 'Ada Corrected',
        ]);
        $this->assertDatabaseHas('customer_order_modifications', [
            'order_id' => $order->id,
            'change_type' => 'delivery_address',
        ]);
        $this->assertSame('123 Test Street', $order->addressVersions()->where('version', 1)->value('address_line_1'));
        $this->assertFalse($order->address()->isOneOfMany());
        $this->assertSame(2, $order->fresh()->address->version);
        $this->assertSame($pricing, $order->pricingSnapshot()->firstOrFail()->getAttributes());

        // Exact replay succeeds even if the mutable source address subsequently moves.
        $replacement->update(['postal_code' => '9999']);
        $this->withHeader('Idempotency-Key', $key)
            ->patchJson('/api/v1/customer/orders/'.$order->id.'/modification', [
                'address_id' => $replacement->id, 'expected_revision' => 1,
            ])->assertOk()->assertJsonPath('data.deliveryAddress.version', 2);
        $this->assertDatabaseCount('customer_order_modifications', 1);
        $this->assertDatabaseCount('order_addresses', 2);
        $this->withHeader('Idempotency-Key', $key)
            ->patchJson('/api/v1/customer/orders/'.$order->id.'/modification', [
                'address_id' => $replacement->id, 'expected_revision' => 2,
            ])->assertConflict()->assertJsonPath('code', 'IDEMPOTENCY_KEY_REUSED');
    }

    #[DataProvider('changedLocations')]
    public function test_customer_cannot_change_the_frozen_delivery_location(array $changes): void
    {
        [$customer, $order] = $this->placedOrder();
        $replacement = $this->address($customer);
        $replacement->update(['recipient_name' => 'Ada Corrected', ...$changes]);
        $before = $order->getAttributes();
        $pricing = $order->pricingSnapshot->getAttributes();
        $events = $order->statusEvents()->count();
        $movements = InventoryMovement::count();

        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->patchJson('/api/v1/customer/orders/'.$order->id.'/modification', [
                'address_id' => $replacement->id, 'expected_revision' => 1,
            ])->assertUnprocessable()
            ->assertJsonPath('code', 'ADDRESS_LOCATION_CHANGE_NOT_ALLOWED')
            ->assertJsonValidationErrors('address_id');

        $this->assertSame($before, $order->fresh()->getAttributes());
        $this->assertSame($pricing, $order->pricingSnapshot()->firstOrFail()->getAttributes());
        $this->assertSame($events, $order->statusEvents()->count());
        $this->assertSame($movements, InventoryMovement::count());
        $this->assertDatabaseCount('order_addresses', 1);
        $this->assertDatabaseCount('customer_order_modifications', 0);
    }

    public static function changedLocations(): array
    {
        return [
            'street' => [['address_line_1' => '456 Another Street']],
            'unit' => [['address_line_2' => 'Unit 2']],
            'barangay' => [['barangay' => 'Poblacion']],
            'city' => [['city_municipality' => 'Pasig City']],
            'province' => [['province' => 'Rizal']],
            'region' => [['region' => 'Region IV-A']],
            'postal / unsupported coverage' => [['postal_code' => '9999']],
            'country' => [['country' => 'Other country']],
            'added map pin' => [['latitude' => 14.5, 'longitude' => 121.1]],
            'incomplete map pin' => [['latitude' => 14.5]],
        ];
    }

    public function test_original_address_row_can_supply_contact_corrections_and_formatting_equivalence(): void
    {
        [$customer, $order] = $this->placedOrder(true);
        $original = $order->address->getAttributes();
        $address = Address::findOrFail($order->address->source_address_id);
        $address->update([
            'recipient_name' => 'Updated Recipient', 'address_line_1' => ' 123 Test Street ',
            'address_line_2' => ' ', 'latitude' => '14.5000000', 'longitude' => '121.1000000',
        ]);

        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->patchJson('/api/v1/customer/orders/'.$order->id.'/modification', [
                'address_id' => $address->id, 'expected_revision' => 1,
            ])->assertOk()
            ->assertJsonPath('data.deliveryAddress.recipientName', 'Updated Recipient')
            ->assertJsonPath('data.deliveryAddress.addressLine1', '123 Test Street')
            ->assertJsonPath('data.deliveryAddress.addressLine2', null)
            ->assertJsonPath('data.deliveryAddress.latitude', '14.5000000')
            ->assertJsonPath('data.deliveryAddress.longitude', '121.1000000');

        $this->assertSame($original, $order->addressVersions()->where('version', 1)->firstOrFail()->getAttributes());
        $this->assertSame(' 123 Test Street ', $address->fresh()->address_line_1);
        $this->assertSame($address->id, $order->fresh()->address->source_address_id);
    }

    #[DataProvider('changedPins')]
    public function test_pinned_order_rejects_changed_or_removed_coordinates(array $changes): void
    {
        [$customer, $order] = $this->placedOrder(true);
        $address = Address::findOrFail($order->address->source_address_id);
        $address->update(['contact_number' => '09179876543', ...$changes]);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->patchJson('/api/v1/customer/orders/'.$order->id.'/modification', ['address_id' => $address->id])
            ->assertUnprocessable()->assertJsonPath('code', 'ADDRESS_LOCATION_CHANGE_NOT_ALLOWED');
        $this->assertDatabaseCount('order_addresses', 1);
        $this->assertDatabaseCount('customer_order_modifications', 0);
    }

    public static function changedPins(): array
    {
        return [
            'latitude' => [['latitude' => '14.5000001']],
            'longitude' => [['longitude' => '121.1000001']],
            'removed' => [['latitude' => null, 'longitude' => null]],
            'partial' => [['longitude' => null]],
        ];
    }

    public function test_unverifiable_order_location_and_unchanged_contacts_are_rejected(): void
    {
        [$customer, $order] = $this->placedOrder();
        $address = $this->address($customer);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->patchJson('/api/v1/customer/orders/'.$order->id.'/modification', ['address_id' => $address->id])
            ->assertConflict()->assertJsonPath('code', 'ADDRESS_UNCHANGED');

        $order->address->update(['region' => '']);
        $address->update(['recipient_name' => 'Corrected Recipient']);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->patchJson('/api/v1/customer/orders/'.$order->id.'/modification', ['address_id' => $address->id])
            ->assertUnprocessable()->assertJsonPath('code', 'ADDRESS_LOCATION_CHANGE_NOT_ALLOWED');
        $this->assertDatabaseCount('order_addresses', 1);
        $this->assertDatabaseCount('customer_order_modifications', 0);
    }

    public function test_contact_corrections_still_require_owned_shipping_addresses_and_eligible_orders(): void
    {
        [$customer, $order] = $this->placedOrder();
        $address = $this->address($customer);
        $address->update(['recipient_name' => 'Corrected', 'type' => AddressType::Billing]);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->patchJson('/api/v1/customer/orders/'.$order->id.'/modification', ['address_id' => $address->id])
            ->assertUnprocessable()->assertJsonPath('code', 'ADDRESS_NOT_SHIPPING');
        $address->update(['type' => AddressType::Shipping, 'region' => '']);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->patchJson('/api/v1/customer/orders/'.$order->id.'/modification', ['address_id' => $address->id])
            ->assertUnprocessable()->assertJsonPath('code', 'ADDRESS_INCOMPLETE');
        $address->update(['user_id' => User::factory()->create()->id, 'type' => AddressType::Shipping]);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->patchJson('/api/v1/customer/orders/'.$order->id.'/modification', ['address_id' => $address->id])
            ->assertUnprocessable()->assertJsonPath('code', 'ADDRESS_NOT_FOUND');
        $order->update(['status' => OrderStatus::SellerProcessing]);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->patchJson('/api/v1/customer/orders/'.$order->id.'/modification', ['address_id' => $address->id])
            ->assertConflict()->assertJsonPath('code', 'ORDER_NOT_MODIFIABLE');
        $this->assertDatabaseCount('customer_order_modifications', 0);
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
