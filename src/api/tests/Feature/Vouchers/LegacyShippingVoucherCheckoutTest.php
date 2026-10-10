<?php

namespace Tests\Feature\Vouchers;

use App\Models\CheckoutQuote;
use App\Models\CommissionPolicy;
use App\Models\InventoryBalance;
use App\Models\InventorySku;
use App\Models\Order;
use App\Models\ShopLogisticsProvider;
use App\Services\Finance\OrderPricingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\LegacyShippingVoucherFixtures;
use Tests\TestCase;

class LegacyShippingVoucherCheckoutTest extends TestCase
{
    use LegacyShippingVoucherFixtures, RefreshDatabase;

    public static function fundingBoundaries(): array
    {
        return [
            'one cent below' => ['10.00', 'fixed', '8.99', true, 1],
            'exact funding' => ['10.00', 'fixed', '9.00', true, 0],
            'one cent above' => ['10.00', 'fixed', '9.01', false, 0],
            'audit shortfall' => ['10.00', 'fixed', '20.00', false, 0],
            'percent exact funding' => ['10.00', 'percent', '45.00', true, 0],
            'percent above' => ['10.00', 'percent', '45.05', false, 0],
            'rounded commission exact' => ['0.05', 'fixed', '0.04', true, 0],
            'rounded commission above' => ['0.05', 'fixed', '0.05', false, 0],
        ];
    }

    #[DataProvider('fundingBoundaries')]
    public function test_quote_candidates_and_selection_use_full_saving_after_rounded_commission(string $price, string $type, string $value, bool $eligible, int $proceeds): void
    {
        $context = $this->legacyContext($price);
        $voucher = $this->legacyVoucher($context, ['value_type' => $type, 'value' => $value]);
        $intent = $this->legacyIntent($context);
        $candidate = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()->json('data.groups.0.availableVouchers.0');
        $this->assertSame($eligible, $candidate['eligible']);
        $this->assertSame($eligible ? null : 'VOUCHER_FUNDING_INSUFFICIENT', $candidate['reason']);
        $this->assertSame($eligible ? ($type === 'percent' ? '9.00' : $value) : '0.00', $candidate['saving']);
        $intent = $this->legacyIntent($context, [$voucher]);
        $response = $this->postJson('/api/v1/customer/checkout/quote', $intent);
        if (! $eligible) {
            $response->assertConflict()->assertJsonPath('code', 'VOUCHER_FUNDING_INSUFFICIENT')->assertJsonValidationErrors('vouchers');
            $this->assertNoPlacement($context, [$voucher]);

            return;
        }
        $quote = $response->assertOk()->json('data');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/customer/checkout/place', [...$intent, 'quote_id' => $quote['quoteId']])->assertOk();
        $snapshot = Order::sole()->pricingSnapshot;
        $this->assertSame($proceeds, $snapshot->seller_proceeds_cents);
        $this->assertSame($snapshot->cod_total_cents, $snapshot->seller_proceeds_cents + $snapshot->seller_commission_cents + $snapshot->logistics_pool_cents + $snapshot->logistics_commission_cents);
        $this->assertSame(1, $voucher->fresh()->redeemed_count);
    }

    public function test_selected_merchandise_discount_reduces_capacity_in_both_uuid_orders(): void
    {
        $context = $this->legacyContext('20.00');
        foreach ([true, false] as $shippingFirst) {
            $shipping = $this->legacyVoucher($context, ['id' => $shippingFirst ? '10000000-0000-4000-8000-000000000001' : '20000000-0000-4000-8000-000000000001', 'value' => '10.00']);
            // IDs are assigned explicitly to exercise normalized selection ordering.
            $discount = $this->legacyVoucher($context, ['id' => $shippingFirst ? '20000000-0000-4000-8000-000000000002' : '10000000-0000-4000-8000-000000000002', 'benefit_type' => 'discount', 'value' => '10.00']);
            $this->assertSame($shippingFirst, strcmp($shipping->id, $discount->id) < 0);
            $candidate = collect($this->postJson('/api/v1/customer/checkout/quote', $this->legacyIntent($context, [$discount]))->assertOk()->json('data.groups.0.availableVouchers'))->firstWhere('id', $shipping->id);
            $this->assertSame(['eligible' => false, 'reason' => 'VOUCHER_FUNDING_INSUFFICIENT', 'saving' => '0.00'], array_intersect_key($candidate, array_flip(['eligible', 'reason', 'saving'])));
            foreach ([[$shipping, $discount], [$discount, $shipping]] as $selections) {
                $this->postJson('/api/v1/customer/checkout/quote', $this->legacyIntent($context, $selections))->assertConflict()->assertJsonPath('code', 'VOUCHER_FUNDING_INSUFFICIENT');
            }
            $shipping->claims()->delete();
            $discount->claims()->delete();
            $shipping->delete();
            $discount->delete();
        }
        $this->assertNoPlacement($context, []);
    }

    public function test_app_merchandise_discount_preserves_seller_capacity_and_funds_balance(): void
    {
        $context = $this->legacyContext();
        $shipping = $this->legacyVoucher($context);
        $app = $this->legacyVoucher($context, ['issuer_type' => 'app', 'shop_id' => null, 'benefit_type' => 'discount', 'value' => '10.00']);
        $intent = $this->legacyIntent($context, [$app, $shipping]);
        $quote = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()->json('data');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/customer/checkout/place', [...$intent, 'quote_id' => $quote['quoteId']])->assertOk();
        $snapshot = Order::sole()->pricingSnapshot;
        $this->assertSame(0, $snapshot->seller_proceeds_cents);
        $this->assertSame(1100, $snapshot->cod_total_cents);
        $this->assertSame(2100, $snapshot->seller_commission_cents + $snapshot->logistics_commission_cents + $snapshot->logistics_pool_cents);
        $this->assertSame(1000, collect($snapshot->voucher_funding)->where('issuer', 'app')->sum('amount_cents'));
    }

    public function test_existing_caps_and_seller_merchandise_pairing_can_fund_the_full_selected_saving(): void
    {
        $context = $this->legacyContext('20.00');
        $shipping = $this->legacyVoucher($context, ['value_type' => 'percent', 'value' => '100.00', 'maximum_discount' => '9.00']);
        $merchandise = $this->legacyVoucher($context, ['benefit_type' => 'discount', 'value' => '10.00']);
        $intent = $this->legacyIntent($context, [$shipping, $merchandise]);
        $quote = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()->assertJsonPath('data.summary.shippingDiscount', '9.00')->assertJsonPath('data.summary.discount', '10.00')->json('data');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/customer/checkout/place', [...$intent, 'quote_id' => $quote['quoteId']])->assertOk();
        $snapshot = Order::sole()->pricingSnapshot;
        $this->assertSame([1000, 100, 0, 2100], [$snapshot->seller_commission_base_cents, $snapshot->seller_commission_cents, $snapshot->seller_proceeds_cents, $snapshot->cod_total_cents]);
        $this->assertSame(1, $shipping->fresh()->redeemed_count);
        $this->assertSame(1, $merchandise->fresh()->redeemed_count);
    }

    public function test_other_shop_proceeds_cannot_cover_shortfall_and_entire_batch_stays_unplaced(): void
    {
        $context = $this->legacyContext();
        [$seller, $shop] = $this->sellerShop();
        // Reuse the same main category/rate rules while preserving a separate tenant.
        $shop->update(['shop_category_id' => $context['shop']->shop_category_id]);
        $otherProduct = $context['product']->fresh()->replicate();
        $otherProduct->fill(['shop_id' => $shop->id, 'slug' => 'other-product', 'base_sku' => 'OTHER', 'price' => '100.00'])->save();
        $sku = InventorySku::create(['product_id' => $otherProduct->id, 'shop_id' => $shop->id, 'code' => 'OTHER', 'is_base' => true, 'status' => 'active']);
        $otherBalance = InventoryBalance::create(['inventory_sku_id' => $sku->id, 'on_hand' => 10, 'reserved' => 0]);
        ShopLogisticsProvider::create(['shop_id' => $shop->id, 'logistics_organization_id' => $context['origin'][1]->id, 'configured_by' => $seller->id, 'is_enabled' => true]);
        $voucher = $this->legacyVoucher($context);
        $firstCart = $this->postJson('/api/v1/customer/cart/items', ['product_id' => $context['product']->id, 'variant_id' => null, 'quantity' => 1])->assertOk()->json('data.items.0');
        $otherCart = $this->postJson('/api/v1/customer/cart/items', ['product_id' => $otherProduct->id, 'variant_id' => null, 'quantity' => 1])->assertOk()->json('data.items.1');
        $intent = $this->legacyIntent($context, [$voucher]);
        unset($intent['buy_now']);
        $intent['mode'] = 'cart';
        $intent['cart_item_ids'] = [$firstCart['id'], $otherCart['id']];
        $intent['logistics_selections'][] = ['shop_id' => $shop->id, 'logistics_organization_id' => $context['origin'][1]->id];
        $quote = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()->json('data');
        $voucher->update(['value' => '20.00']);
        $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertConflict()->assertJsonPath('code', 'VOUCHER_FUNDING_INSUFFICIENT');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/customer/checkout/place', [...$intent, 'quote_id' => $quote['quoteId']])->assertConflict()->assertJsonPath('code', 'QUOTE_STALE');
        $this->assertNoPlacement($context, [$voucher]);
        $this->assertSame([10, 0], [$otherBalance->fresh()->on_hand, $otherBalance->fresh()->reserved]);
        $this->assertDatabaseCount('cart_items', 2);
    }

    public function test_existing_eligibility_reasons_take_precedence_and_foreign_shop_vouchers_are_isolated(): void
    {
        $context = $this->legacyContext();
        $voucher = $this->legacyVoucher($context, ['value' => '20.00', 'is_active' => false]);
        $this->postJson('/api/v1/customer/checkout/quote', $this->legacyIntent($context))->assertOk()->assertJsonPath('data.groups.0.availableVouchers.0.reason', 'VOUCHER_INACTIVE');
        [, $foreignShop] = $this->sellerShop();
        $voucher->update(['is_active' => true, 'shop_id' => $foreignShop->id]);
        $this->postJson('/api/v1/customer/checkout/quote', $this->legacyIntent($context))->assertOk()->assertJsonCount(0, 'data.groups.0.availableVouchers');
        $this->postJson('/api/v1/customer/checkout/quote', $this->legacyIntent($context, [$voucher]))->assertUnprocessable();
        $this->assertNoPlacement($context, [$voucher]);
    }

    public function test_zero_shipping_still_allows_zero_saving_without_inventing_funding(): void
    {
        $context = $this->legacyContext();
        $context['origin'][1]->rateCards()->sole()->services()->update(['base_fee_cents' => 0]);
        $voucher = $this->legacyVoucher($context, ['value' => '20.00']);
        $intent = $this->legacyIntent($context, [$voucher]);
        $quote = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()->assertJsonPath('data.groups.0.availableVouchers.0.saving', '0.00')->json('data');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/customer/checkout/place', [...$intent, 'quote_id' => $quote['quoteId']])->assertOk();
        $this->assertSame(900, Order::sole()->pricingSnapshot->seller_proceeds_cents);
        $this->assertSame(1, $voucher->fresh()->redeemed_count);
    }

    public function test_funding_loss_after_quote_rolls_back_every_cart_effect_and_allows_reviewed_refresh(): void
    {
        $context = $this->legacyContext();
        $voucher = $this->legacyVoucher($context);
        $cart = $this->postJson('/api/v1/customer/cart/items', ['product_id' => $context['product']->id, 'variant_id' => null, 'quantity' => 1])->assertOk()->json('data.items.0');
        $intent = $this->legacyIntent($context, [$voucher]);
        unset($intent['buy_now']);
        $intent['mode'] = 'cart';
        $intent['cart_item_ids'] = [$cart['id']];
        $quote = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()->json('data');
        CommissionPolicy::where('beneficiary_type', 'seller')->update(['rate_basis_points' => 2000]);
        $key = (string) Str::uuid();
        for ($retry = 0; $retry < 2; $retry++) {
            $this->withHeader('Idempotency-Key', $key)->postJson('/api/v1/customer/checkout/place', [...$intent, 'quote_id' => $quote['quoteId']])->assertConflict()->assertJsonPath('code', 'QUOTE_STALE')->assertJsonValidationErrors('vouchers');
            $this->assertNoPlacement($context, [$voucher]);
            $this->assertDatabaseHas('cart_items', ['id' => $cart['id'], 'quantity' => 1]);
        }
        $intent['vouchers'] = [];
        $fresh = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()->json('data');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/customer/checkout/place', [...$intent, 'quote_id' => $fresh['quoteId']])->assertOk();
        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('cart_items', 0);
        $this->assertSame(0, $voucher->fresh()->redeemed_count);
    }

    public function test_pre_fix_unfunded_quote_cannot_place_and_committed_requests_still_replay(): void
    {
        $context = $this->legacyContext();
        $voucher = $this->legacyVoucher($context, ['value' => '20.00']);
        $intent = $this->legacyIntent($context, [$voucher]);
        $pricing = app(OrderPricingService::class);
        $this->mock(OrderPricingService::class, function ($mock) use ($pricing): void {
            $mock->makePartial();
            $legacy = true;
            $mock->shouldReceive('calculate')->andReturnUsing(function (array $group) use ($pricing, &$legacy): array {
                if (! $legacy) {
                    return $pricing->calculate($group);
                }
                $legacy = false;
                // Model the old clamped calculation solely to mint a pre-fix quote.
                $old = $pricing->calculate([...$group, 'applied_vouchers' => [], 'payable_cents' => $group['subtotal_cents'] + $group['shipping_cents']]);
                $old['seller_proceeds_cents'] = 0;

                return $old;
            });
        });
        $quote = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()->json('data');
        $this->app->instance(OrderPricingService::class, $pricing);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/customer/checkout/place', [...$intent, 'quote_id' => $quote['quoteId']])->assertConflict()->assertJsonPath('code', 'QUOTE_STALE');
        $this->assertNoPlacement($context, [$voucher]);
        $voucher->update(['value' => '9.00']);
        $fresh = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()->json('data');
        $key = (string) Str::uuid();
        $placement = [...$intent, 'quote_id' => $fresh['quoteId']];
        $batch = $this->withHeader('Idempotency-Key', $key)->postJson('/api/v1/customer/checkout/place', $placement)->assertOk()->json('data');
        $voucher->update(['value' => '20.00']);
        $this->postJson('/api/v1/customer/checkout/place', $placement)->assertOk()->assertJsonPath('data.id', $batch['id']);
        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('voucher_redemptions', 1);
        $this->assertSame(1, $voucher->fresh()->redeemed_count);
        $this->assertSame(0, Order::sole()->pricingSnapshot->seller_proceeds_cents);
        $this->assertSame('9.00', Order::sole()->vouchers()->sole()->discount_amount);
        $this->assertNotNull(CheckoutQuote::find($quote['quoteId']));
    }

    private function assertNoPlacement(array $context, array $vouchers): void
    {
        foreach (['checkout_batches', 'orders', 'order_pricing_snapshots', 'order_vouchers', 'voucher_redemptions', 'inventory_movements'] as $table) {
            $this->assertDatabaseCount($table, 0);
        }
        $this->assertSame([10, 0], [$context['balance']->fresh()->on_hand, $context['balance']->fresh()->reserved]);
        foreach ($vouchers as $voucher) {
            $this->assertSame(0, $voucher->fresh()->redeemed_count);
        }
    }
}
