<?php

namespace Tests\Feature\Customer;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Events\CustomerOrderStatusChanged;
use App\Events\SellerOrderBecameActionable;
use App\Models\Address;
use App\Models\InventoryBalance;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherClaim;
use App\Services\Customer\CheckoutAddressFingerprint;
use Database\Seeders\ProductSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\ConfiguresCheckoutFinance;
use Tests\TestCase;

class CheckoutAddressFingerprintTest extends TestCase
{
    use ConfiguresCheckoutFinance, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->freezeTime();
        $this->seed(ProductSeeder::class);
        $this->configureTestCheckoutFinance();
        Event::fake([CustomerOrderStatusChanged::class, SellerOrderBecameActionable::class]);
    }

    public static function addressEdits(): array
    {
        $edits = [
            'recipient' => ['recipient_name' => 'Grace Buyer'],
            'contact' => ['contact_number' => '09179876543'],
            'street' => ['address_line_1' => '456 Test Street'],
            'second line added' => ['address_line_2' => 'Unit 2'],
            'second line removed' => ['address_line_2' => null],
            'barangay' => ['barangay' => 'Bel-Air'],
            'city' => ['city_municipality' => 'Taguig City'],
            'province' => ['province' => 'Rizal'],
            'region' => ['region' => 'Region IV-A'],
            'postal code' => ['postal_code' => '1204'],
            'country' => ['country' => 'PH'],
            'label' => ['label' => 'Office'],
            'shipping type' => ['type' => 'both'],
            'pin added' => ['latitude' => '14.5547290', 'longitude' => '121.0244452'],
            'latitude seventh decimal' => ['latitude' => '14.5547291', 'longitude' => '121.0244452'],
            'longitude seventh decimal' => ['latitude' => '14.5547290', 'longitude' => '121.0244453'],
            'pin removed' => ['latitude' => null, 'longitude' => null],
        ];
        $cases = [];
        foreach (['buy_now', 'cart'] as $mode) {
            foreach ($edits as $name => $edit) {
                $before = match ($name) {
                    'second line removed' => ['address_line_2' => 'Unit 1'],
                    'latitude seventh decimal', 'longitude seventh decimal', 'pin removed' => ['latitude' => '14.5547290', 'longitude' => '121.0244452'],
                    default => [],
                };
                $cases[$mode.' '.$name] = [$mode, $before, $edit];
            }
        }

        return $cases;
    }

    #[DataProvider('addressEdits')]
    public function test_same_second_address_edits_require_a_new_quote_without_placement_effects(string $mode, array $before, array $edit): void
    {
        [$address, $intent, $voucher] = $this->checkout($mode, $before);
        $quoteId = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()->json('data.quoteId');
        $timestamp = $address->updated_at->getTimestamp();
        $effects = $this->placementEffects();

        $this->patchJson('/api/v1/customer/addresses/'.$address->id, $this->addressInput([...$before, ...$edit]))->assertOk();
        $this->assertSame($timestamp, $address->fresh()->updated_at->getTimestamp());

        $key = (string) Str::uuid();
        for ($retry = 0; $retry < 2; $retry++) {
            $this->withHeader('Idempotency-Key', $key)
                ->postJson('/api/v1/customer/checkout/place', [...$intent, 'quote_id' => $quoteId])
                ->assertConflict()->assertJsonPath('code', 'QUOTE_STALE')->assertJsonValidationErrors('quote_id');
            $this->assertSame($effects, $this->placementEffects());
            $this->assertSame(0, $voucher->fresh()->redeemed_count);
            Event::assertNotDispatched(CustomerOrderStatusChanged::class);
            Event::assertNotDispatched(SellerOrderBecameActionable::class);
        }
    }

    public function test_unchanged_address_places_and_committed_replay_retains_the_reviewed_snapshot(): void
    {
        [$address, $intent] = $this->checkout('buy_now', ['latitude' => '14.5547290', 'longitude' => '121.0244452']);
        $quoteId = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()->json('data.quoteId');
        $key = (string) Str::uuid();
        $placement = [...$intent, 'quote_id' => $quoteId];
        $batchId = $this->withHeader('Idempotency-Key', $key)->postJson('/api/v1/customer/checkout/place', $placement)
            ->assertOk()->assertJsonPath('data.orders.0.address.recipientName', 'Ada Buyer')->json('data.id');
        $effects = $this->placementEffects();

        $this->patchJson('/api/v1/customer/addresses/'.$address->id, $this->addressInput([
            'recipient_name' => 'Grace Buyer', 'address_line_1' => '456 Test Street',
            'latitude' => '14.5547291', 'longitude' => '121.0244453',
        ]))->assertOk();

        $this->postJson('/api/v1/customer/checkout/place', $placement)
            ->assertOk()->assertJsonPath('data.id', $batchId)
            ->assertJsonPath('data.orders.0.address.recipientName', 'Ada Buyer');
        $this->assertSame($effects, $this->placementEffects());
        $snapshot = Order::sole()->address;
        $this->assertSame('123 Test Street', $snapshot->address_line_1);
        $this->assertSame('14.5547290', $snapshot->latitude);
        $this->assertSame('121.0244452', $snapshot->longitude);
    }

    public function test_refreshed_quote_places_the_new_address_and_redeems_only_once(): void
    {
        [$address, $intent, $voucher] = $this->checkout('cart');
        $oldQuoteId = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()->json('data.quoteId');
        $this->patchJson('/api/v1/customer/addresses/'.$address->id, $this->addressInput([
            'recipient_name' => 'Grace Buyer', 'address_line_2' => 'Unit 2',
            'latitude' => '14.5547291', 'longitude' => '121.0244453',
        ]))->assertOk();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/customer/checkout/place', [...$intent, 'quote_id' => $oldQuoteId])
            ->assertConflict()->assertJsonPath('code', 'QUOTE_STALE');
        $quoteId = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()
            ->assertJsonPath('data.address.recipientName', 'Grace Buyer')
            ->assertJsonPath('data.address.addressLine2', 'Unit 2')->json('data.quoteId');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/customer/checkout/place', [...$intent, 'quote_id' => $quoteId])
            ->assertOk()->assertJsonPath('data.orders.0.address.recipientName', 'Grace Buyer');
        $snapshot = Order::sole()->address;
        $this->assertSame('Unit 2', $snapshot->address_line_2);
        $this->assertSame('14.5547291', $snapshot->latitude);
        $this->assertSame('121.0244453', $snapshot->longitude);
        $this->assertDatabaseCount('checkout_batches', 1);
        $this->assertDatabaseCount('cart_items', 0);
        $this->assertDatabaseCount('voucher_redemptions', 1);
        $this->assertSame(1, $voucher->fresh()->redeemed_count);
    }

    public function test_unplaced_legacy_fingerprint_requires_reviewed_refresh(): void
    {
        [$address, $intent] = $this->checkout('buy_now');
        $legacy = true;
        $this->useLegacyAddressFingerprint($legacy);
        $quoteId = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()->json('data.quoteId');
        $legacy = false;
        $effects = $this->placementEffects();

        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/customer/checkout/place', [...$intent, 'quote_id' => $quoteId])
            ->assertConflict()->assertJsonPath('code', 'QUOTE_STALE');
        $this->assertSame($effects, $this->placementEffects());
        $this->assertSame('Ada Buyer', $address->fresh()->recipient_name);
        $freshQuoteId = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()->json('data.quoteId');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/customer/checkout/place', [...$intent, 'quote_id' => $freshQuoteId])->assertOk();
    }

    public function test_committed_legacy_quote_still_replays_after_the_fingerprint_rollout(): void
    {
        [$address, $intent] = $this->checkout('buy_now');
        $legacy = true;
        $this->useLegacyAddressFingerprint($legacy);
        $quoteId = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()->json('data.quoteId');
        $placement = [...$intent, 'quote_id' => $quoteId];
        $batchId = $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/customer/checkout/place', $placement)->assertOk()->json('data.id');
        $effects = $this->placementEffects();
        $this->patchJson('/api/v1/customer/addresses/'.$address->id, $this->addressInput(['recipient_name' => 'Grace Buyer']))->assertOk();
        $legacy = false;

        $this->postJson('/api/v1/customer/checkout/place', $placement)
            ->assertOk()->assertJsonPath('data.id', $batchId)
            ->assertJsonPath('data.orders.0.address.recipientName', 'Ada Buyer');
        $this->assertSame($effects, $this->placementEffects());
    }

    public function test_equivalent_normalized_address_and_coordinate_values_do_not_invalidate_a_quote(): void
    {
        [$address, $intent] = $this->checkout('buy_now', ['latitude' => '14.5547290', 'longitude' => '121.0244452']);
        $quoteId = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()->json('data.quoteId');
        $this->patchJson('/api/v1/customer/addresses/'.$address->id, $this->addressInput([
            'recipient_name' => '  Ada Buyer  ', 'latitude' => 14.554729, 'longitude' => 121.0244452,
        ]))->assertOk();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/customer/checkout/place', [...$intent, 'quote_id' => $quoteId])->assertOk();
    }

    private function useLegacyAddressFingerprint(bool &$legacy): void
    {
        $fingerprint = app(CheckoutAddressFingerprint::class);
        $this->mock(CheckoutAddressFingerprint::class, function ($mock) use (&$legacy, $fingerprint): void {
            // Simulate deployment between requests, including Laravel's cached controllers.
            $mock->shouldReceive('state')->andReturnUsing(
                function (Address $address) use (&$legacy, $fingerprint): array {
                    return $legacy
                        ? [$address->id, $address->updated_at?->getTimestamp()]
                        : $fingerprint->state($address);
                },
            );
        });
    }

    /** @return array{Address, array<string, mixed>, Voucher} */
    private function checkout(string $mode, array $addressOverrides = []): array
    {
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        Sanctum::actingAs($customer);
        $addressId = $this->postJson('/api/v1/customer/addresses', $this->addressInput($addressOverrides))
            ->assertCreated()->json('data.id');
        $address = Address::findOrFail($addressId);
        $product = Product::where('slug', 'compact-everyday-camera')->firstOrFail();
        $voucher = Voucher::create([
            'code' => 'ADDRESS10', 'issuer_type' => 'shop', 'shop_id' => $product->shop_id,
            'benefit_type' => 'discount', 'value_type' => 'fixed', 'value' => '10.00',
            'minimum_spend' => '0.00', 'starts_at' => now()->subDay(), 'ends_at' => now()->addDay(),
            'per_customer_limit' => 1, 'terms_summary' => 'Address regression voucher.', 'stacking_policy' => [],
        ]);
        VoucherClaim::create(['voucher_id' => $voucher->id, 'customer_id' => $customer->id, 'collected_at' => now()]);
        $intent = [
            'mode' => $mode, 'address_id' => $addressId, 'payment_method' => 'cod',
            'vouchers' => [['voucher_id' => $voucher->id, 'target_shop_id' => $product->shop_id]],
        ];
        if ($mode === 'cart') {
            $itemId = $this->postJson('/api/v1/customer/cart/items', ['product_id' => $product->id, 'variant_id' => null, 'quantity' => 1])
                ->assertOk()->json('data.items.0.id');
            $intent['cart_item_ids'] = [$itemId];
        } else {
            $intent['buy_now'] = ['product_id' => $product->id, 'variant_id' => null, 'quantity' => 1];
        }

        return [$address, $intent, $voucher];
    }

    private function addressInput(array $overrides = []): array
    {
        return [...[
            'type' => 'shipping', 'label' => 'Home', 'recipient_name' => 'Ada Buyer',
            'contact_number' => '09171234567', 'address_line_1' => '123 Test Street',
            'address_line_2' => null, 'barangay' => 'San Antonio', 'city_municipality' => 'Makati City',
            'province' => 'Metro Manila', 'region' => 'NCR', 'postal_code' => '1203', 'country' => 'Philippines',
            'latitude' => null, 'longitude' => null, 'is_default' => false,
        ], ...$overrides];
    }

    private function placementEffects(): array
    {
        $effects = [];
        foreach (['checkout_batches', 'orders', 'order_items', 'order_addresses', 'order_pricing_snapshots',
            'order_status_events', 'order_vouchers', 'voucher_claims', 'voucher_redemptions', 'inventory_movements', 'cart_items', 'notifications'] as $table) {
            $effects[$table] = DB::table($table)->orderBy('id')->get()->map(fn ($row) => (array) $row)->all();
        }
        $effects['balances'] = InventoryBalance::query()->orderBy('id')->get()->toArray();
        $effects['products'] = Product::query()->orderBy('id')->get()->toArray();

        return $effects;
    }
}
