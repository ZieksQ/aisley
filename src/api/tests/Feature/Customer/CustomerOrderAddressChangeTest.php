<?php

namespace Tests\Feature\Customer;

use App\Enums\AddressType;
use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Events\CustomerOrderStatusChanged;
use App\Listeners\SendOrderAddressChangeNotifications;
use App\Models\Address;
use App\Models\CommissionPolicy;
use App\Models\CustomerOrderModification;
use App\Models\HubServiceArea;
use App\Models\InventoryMovement;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherClaim;
use App\Models\VoucherRedemption;
use App\Services\Finance\OrderFundingAuditService;
use App\Services\Finance\OrderSnapshotFunding;
use Database\Seeders\ProductSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\ConfiguresCheckoutFinance;
use Tests\TestCase;

class CustomerOrderAddressChangeTest extends TestCase
{
    use ConfiguresCheckoutFinance, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ProductSeeder::class);
        $this->configureTestCheckoutFinance();
    }

    public function test_quote_has_no_order_effect_and_confirmation_versions_address_and_pricing_with_exact_replay(): void
    {
        [$customer, $order, $address] = $this->placed();
        $original = $order->pricingSnapshot->getAttributes();
        $item = $order->items()->firstOrFail()->getAttributes();
        $movements = InventoryMovement::count();
        $this->setServiceFee(2500);
        // Live catalog changes must not alter purchased items or stored parcel dimensions.
        Product::whereKey($item['product_id'])->update(['price' => '9999.00', 'shipping_weight_grams' => 999999]);
        $quote = $this->quote($order, $address)->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.previous.shippingFee', '0.00')->assertJsonPath('data.proposed.shippingFee', '50.00')
            ->assertJsonPath('data.address.addressLine1', '456 New Street')->json('data');
        $this->assertDatabaseCount('order_addresses', 1);
        $this->assertDatabaseCount('order_pricing_snapshots', 1);
        $key = (string) Str::uuid();
        $this->confirm($order, $address, $quote['quoteId'], $key)->assertOk()
            ->assertJsonPath('data.deliveryAddress.version', 2)->assertJsonPath('data.deliveryAddress.postalCode', '1204')
            ->assertJsonPath('data.totals.shippingFee', '50.00');
        $fresh = $order->fresh();
        $this->assertSame(2, $fresh->pricingSnapshot->version);
        $this->assertSame(2, $fresh->pricingSnapshot->address_version);
        $this->assertSame('1204', $fresh->pricingSnapshot->destination_snapshot['postal_code']);
        $this->assertSame('1204', $fresh->pricingSnapshot->shipping_route_snapshot['destination_postal_code']);
        $this->assertSame($original, $fresh->pricingSnapshot()->where('version', 1)->firstOrFail()->getAttributes());
        $this->assertSame($item, $fresh->items()->firstOrFail()->getAttributes());
        $this->assertSame($movements, InventoryMovement::count());
        $this->assertSame(0, app(OrderSnapshotFunding::class)->inspect($fresh->pricingSnapshot)['difference_cents']);
        $this->assertSame('456 New Street', $address->fresh()->address_line_1);
        $order->update(['status' => OrderStatus::SellerProcessing]);
        $address->delete();
        $this->travel(20)->minutes();
        $this->confirm($order, $address, $quote['quoteId'], $key)->assertOk();
        $this->assertDatabaseCount('order_addresses', 2);
        $this->assertDatabaseCount('order_pricing_snapshots', 2);
        $this->assertDatabaseCount('customer_order_modifications', 1);
        $this->confirm($order, $address, (string) Str::uuid(), $key)->assertConflict()->assertJsonPath('code', 'IDEMPOTENCY_KEY_REUSED');
    }

    public function test_stale_address_same_second_rates_and_expiry_require_a_new_review(): void
    {
        [, $order, $address] = $this->placed();
        $quote = $this->quote($order, $address)->assertOk()->json('data.quoteId');
        $address->update(['contact_number' => '09179999999']);
        $this->confirm($order, $address, $quote)->assertConflict()->assertJsonPath('code', 'MODIFICATION_QUOTE_STALE');
        $quote = $this->quote($order, $address)->assertOk()->json('data.quoteId');
        $this->setServiceFee(1000);
        $this->confirm($order, $address, $quote)->assertConflict()->assertJsonPath('code', 'MODIFICATION_QUOTE_STALE');
        $quote = $this->quote($order, $address)->assertOk()->json('data.quoteId');
        $this->travel(11)->minutes();
        $this->confirm($order, $address, $quote)->assertConflict()->assertJsonPath('code', 'MODIFICATION_QUOTE_EXPIRED');
        $this->assertDatabaseCount('order_addresses', 1);
        $this->assertDatabaseCount('order_pricing_snapshots', 1);
    }

    public function test_seller_approval_cancellation_and_competing_revision_block_confirmation(): void
    {
        [, $order, $address] = $this->placed();
        $quote = $this->quote($order, $address)->assertOk()->json('data.quoteId');
        foreach ([OrderStatus::SellerProcessing, OrderStatus::Cancelled] as $status) {
            $order->update(['status' => $status]);
            $this->confirm($order, $address, $quote)->assertConflict()->assertJsonPath('code', 'ORDER_NOT_MODIFIABLE');
        }
        $order->update(['status' => OrderStatus::Placed]);
        $quote = $this->quote($order, $address)->assertOk()->json('data.quoteId');
        $this->confirm($order, $address, $quote)->assertOk();
        $this->confirm($order, $address, $quote)->assertConflict()->assertJsonPath('code', 'ORDER_REVISION_STALE');
        $this->assertDatabaseCount('customer_order_modifications', 1);
    }

    public function test_unavailable_provider_and_missing_inputs_never_mutate_the_order(): void
    {
        [, $order, $address] = $this->placed();
        HubServiceArea::where('postal_code', '1204')->update(['is_active' => false]);
        $this->quote($order, $address)->assertConflict()->assertJsonPath('code', 'SHIPPING_COVERAGE_UNAVAILABLE');
        $order->pricingSnapshot->update(['line_inputs' => []]);
        $this->quote($order, $address)->assertConflict()->assertJsonPath('code', 'ORDER_PRICING_UNAVAILABLE');
        $this->assertDatabaseCount('order_addresses', 1);
    }

    public function test_owned_shipping_complete_addresses_and_authoritative_fields_are_required(): void
    {
        [$customer, $order, $address] = $this->placed();
        $address->update(['type' => AddressType::Billing]);
        $this->quote($order, $address)->assertUnprocessable()->assertJsonPath('code', 'ADDRESS_NOT_SHIPPING');
        $address->update(['type' => AddressType::Both, 'latitude' => 14.5, 'longitude' => null]);
        $this->quote($order, $address)->assertUnprocessable()->assertJsonPath('code', 'ADDRESS_PIN_REQUIRED');
        $address->update(['latitude' => null, 'user_id' => User::factory()->create()->id]);
        $this->quote($order, $address)->assertUnprocessable()->assertJsonPath('code', 'ADDRESS_NOT_FOUND');
        $this->postJson($this->url($order).'/quote', ['address_id' => $address->id, 'expected_revision' => 1, 'shipping_fee' => 0])->assertUnprocessable();
        Sanctum::actingAs(User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]));
        $this->quote($order, $address)->assertNotFound();
        Sanctum::actingAs(User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]));
        $this->quote($order, $address)->assertForbidden();
        Sanctum::actingAs($customer);
        $original = Address::findOrFail($order->address->source_address_id);
        $this->quote($order, $original)->assertConflict()->assertJsonPath('code', 'ADDRESS_UNCHANGED');
    }

    #[DataProvider('issuers')]
    public function test_shipping_saving_is_capped_without_redeeming_again_or_changing_merchandise_discounts(string $issuer): void
    {
        [$customer, $order, $address] = $this->placed($issuer);
        $redemptions = VoucherRedemption::orderBy('id')->get()->toArray();
        $vouchers = $order->vouchers()->orderBy('id')->get()->toArray();
        $this->assertSame('30.00', $order->shipping_discount_total);
        $this->assertSame('10.00', $order->discount_total);
        $this->setServiceFee(500);
        // A redeemed voucher expiring does not make an address change redeem it again.
        Voucher::query()->update(['ends_at' => now()->subMinute()]);
        $quote = $this->quote($order, $address)->assertOk()
            ->assertJsonPath('data.proposed.shippingDiscount', '10.00')->json('data.quoteId');
        $result = $this->confirm($order, $address, $quote)->assertOk()->assertJsonPath('data.totals.discount', '10.00');
        $shipping = collect($result->json('data.vouchers'))->firstWhere('benefitType', 'shipping');
        $this->assertSame('10.00', $shipping['discountAmount']);
        $fresh = $order->fresh();
        $this->assertSame('10.00', $fresh->shipping_discount_total);
        $this->assertSame($redemptions, VoucherRedemption::orderBy('id')->get()->toArray());
        $this->assertSame($vouchers, $order->vouchers()->orderBy('id')->get()->toArray());
        $this->assertSame(0, app(OrderSnapshotFunding::class)->inspect($fresh->pricingSnapshot)['difference_cents']);
        $funding = collect($fresh->pricingSnapshot->voucher_funding)->firstWhere('benefit', 'shipping');
        $this->assertSame($issuer, $funding['issuer']);
        $this->assertSame(1000, $funding['amount_cents']);
        $this->getJson('/api/v1/customer/checkout/'.$order->checkout_batch_id)->assertOk()
            ->assertJsonPath('data.orders.0.totals.shippingDiscount', '10.00');
        // Future increases retain the currently committed saving; original redemptions remain audit facts.
        $address->update(['address_line_1' => '789 Final Street']);
        $this->setServiceFee(2500);
        $nextQuote = $this->postJson($this->url($order).'/quote', ['address_id' => $address->id, 'expected_revision' => 2])
            ->assertOk()->assertJsonPath('data.proposed.shippingDiscount', '10.00')->json('data.quoteId');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->patchJson($this->url($order), [
            'address_id' => $address->id, 'expected_revision' => 2, 'quote_id' => $nextQuote,
        ])->assertOk()->assertJsonPath('data.deliveryAddress.version', 3);
        $this->assertSame(3, $order->fresh()->pricingSnapshot->version);
        $this->assertSame(3, Order::with('pricingSnapshot')->findOrFail($order->id)->pricingSnapshot->version);
    }

    public static function issuers(): array
    {
        return [['app'], ['shop']];
    }

    public function test_failure_writing_history_rolls_back_address_pricing_and_totals(): void
    {
        [, $order, $address] = $this->placed();
        $quote = $this->quote($order, $address)->assertOk()->json('data.quoteId');
        $before = $order->getAttributes();
        $event = 'eloquent.creating: '.CustomerOrderModification::class;
        Event::listen($event, fn () => throw new \RuntimeException('Synthetic history failure'));
        try {
            $this->confirm($order, $address, $quote)->assertStatus(500);
        } finally {
            Event::forget($event);
        }
        $this->assertSame($before, $order->fresh()->getAttributes());
        $this->assertDatabaseCount('order_addresses', 1);
        $this->assertDatabaseCount('order_pricing_snapshots', 1);
        $this->assertDatabaseCount('customer_order_modifications', 0);
    }

    public function test_repricing_preserves_original_commission_policies_and_recomputes_shipping_commission(): void
    {
        CommissionPolicy::where('beneficiary_type', 'seller')->update(['rate_basis_points' => 500]);
        CommissionPolicy::where('beneficiary_type', 'logistics')->update(['rate_basis_points' => 1000]);
        [, $order, $address] = $this->placed('shop');
        $original = $order->pricingSnapshot;
        foreach (['seller', 'logistics'] as $type) {
            CommissionPolicy::create(['beneficiary_type' => $type, 'rate_basis_points' => 9000,
                'status' => 'published', 'effective_at' => now()->subMinute(), 'revision' => 2]);
        }
        $this->setServiceFee(1000);
        $quote = $this->quote($order, $address)->assertOk()->json('data.quoteId');
        $this->confirm($order, $address, $quote)->assertOk();
        $current = $order->fresh()->pricingSnapshot;
        $this->assertSame($original->seller_commission_policy_id, $current->seller_commission_policy_id);
        $this->assertSame($original->logistics_commission_policy_id, $current->logistics_commission_policy_id);
        $this->assertSame($original->seller_commission_cents, $current->seller_commission_cents);
        $this->assertSame(200, $current->logistics_commission_cents);
        $this->assertSame(1800, $current->logistics_pool_cents);
        $this->assertSame(0, app(OrderSnapshotFunding::class)->inspect($current)['difference_cents']);
    }

    public function test_guest_validation_role_and_conflict_responses_are_private(): void
    {
        $id = (string) Str::uuid();
        $this->postJson('/api/v1/customer/orders/'.$id.'/modification/quote', [])
            ->assertUnauthorized()->assertHeader('Cache-Control', 'no-store, private');
        [$customer, $order, $address] = $this->placed();
        $this->postJson($this->url($order).'/quote', [])->assertUnprocessable()
            ->assertHeader('Cache-Control', 'no-store, private');
        $customer->update(['status' => UserStatus::Suspended]);
        $this->quote($order, $address)->assertForbidden()->assertHeader('Cache-Control', 'no-store, private');
        $customer->update(['status' => UserStatus::Active]);
        $order->update(['status' => OrderStatus::SellerProcessing]);
        $this->quote($order, $address)->assertConflict()->assertHeader('Cache-Control', 'no-store, private');
    }

    public function test_address_notifications_are_private_visible_to_both_owners_and_deduplicated(): void
    {
        [$customer, $order, $address] = $this->placed();
        $quote = $this->quote($order, $address)->assertOk()->json('data.quoteId');
        $this->confirm($order, $address, $quote)->assertOk();
        $event = $order->statusEvents()->where('source', 'customer_order_modification')->sole();
        $listener = app(SendOrderAddressChangeNotifications::class);
        $message = new CustomerOrderStatusChanged($event->id);
        $listener->handle($message);
        $listener->handle($message);
        $seller = $order->shop->seller;
        foreach ([[$customer, 'customer'], [$seller, 'seller']] as [$recipient, $role]) {
            $record = $recipient->notifications()->where('type', $role.'-order.address-changed')->sole();
            $this->assertSame($order->id, $record->data['order_id']);
            $this->assertStringNotContainsString('456 New Street', json_encode($record->data));
            Sanctum::actingAs($recipient);
            $this->getJson('/api/v1/'.$role.'/notifications?category=orders')->assertOk()
                ->assertJsonFragment(['id' => $record->id, 'category' => 'orders']);
        }
        $summary = app(OrderFundingAuditService::class)->scan(fn () => null, $order->id);
        $this->assertSame(1, $summary['scanned_snapshots']);
    }

    public function test_pin_removal_after_address_review_blocks_confirmation_without_new_versions(): void
    {
        [$customer, $order, $address] = $this->placed();
        $quote = $this->quote($order, $address)->assertOk()->json('data.quoteId');
        $address->update(['latitude' => null, 'longitude' => null]);
        $this->confirm($order, $address, $quote)->assertUnprocessable()
            ->assertJsonPath('code', 'ADDRESS_PIN_REQUIRED')->assertJsonValidationErrors('address_id');
        $this->assertDatabaseCount('order_addresses', 1);
        $this->assertSame(1, $order->fresh('address')->address->version);
    }

    private function placed(?string $voucherIssuer = null): array
    {
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        Sanctum::actingAs($customer);
        $address = $this->pickupAddress($customer, 'Customer');
        $product = Product::where('slug', 'compact-everyday-camera')->firstOrFail();
        $selections = [];
        if ($voucherIssuer !== null) {
            $this->setServiceFee(2500);
            foreach (['shipping' => '30.00', 'discount' => '10.00'] as $benefit => $value) {
                $voucher = Voucher::create([
                    'code' => strtoupper($benefit), 'issuer_type' => $voucherIssuer,
                    'shop_id' => $voucherIssuer === 'shop' ? $product->shop_id : null,
                    'benefit_type' => $benefit, 'value_type' => 'fixed', 'value' => $value,
                    'minimum_spend' => '0.00', 'starts_at' => now()->subDay(), 'ends_at' => now()->addDay(),
                    'per_customer_limit' => 1, 'terms_summary' => 'Synthetic voucher',
                ]);
                if ($voucherIssuer === 'shop') {
                    VoucherClaim::create(['voucher_id' => $voucher->id, 'customer_id' => $customer->id, 'collected_at' => now()]);
                }
                $selections[] = ['voucher_id' => $voucher->id, 'target_shop_id' => $product->shop_id];
            }
        }
        $payload = ['mode' => 'buy_now', 'buy_now' => ['product_id' => $product->id, 'variant_id' => null, 'quantity' => 1],
            'address_id' => $address->id, 'payment_method' => 'cod', 'vouchers' => $selections];
        $quote = $this->postJson('/api/v1/customer/checkout/quote', $payload)->assertOk()->json('data.quoteId');
        $id = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/customer/checkout/place', [...$payload, 'quote_id' => $quote])->assertOk()->json('data.orders.0.id');
        $other = $address->replicate()->fill(['address_line_1' => '456 New Street', 'postal_code' => '1204', 'is_default' => false]);
        $other->save();

        return [$customer, Order::findOrFail($id), $other];
    }

    private function setServiceFee(int $fee): void
    {
        DB::table('logistics_service_rates')->update(['base_fee_cents' => $fee]);
    }

    private function url(Order $order): string
    {
        return '/api/v1/customer/orders/'.$order->id.'/modification';
    }

    private function quote(Order $order, Address $address)
    {
        return $this->postJson($this->url($order).'/quote', ['address_id' => $address->id, 'expected_revision' => 1]);
    }

    private function confirm(Order $order, Address $address, string $quote, ?string $key = null)
    {
        return $this->withHeader('Idempotency-Key', $key ?? (string) Str::uuid())->patchJson($this->url($order), [
            'address_id' => $address->id, 'expected_revision' => 1, 'quote_id' => $quote,
        ]);
    }
}
