<?php

namespace Tests\Feature\Vouchers;

use App\Models\Order;
use App\Models\Voucher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\Support\OrderLifecycleFixtures;
use Tests\Support\VoucherAuthoringFixtures;
use Tests\TestCase;

class VoucherCheckoutTest extends TestCase
{
    use OrderLifecycleFixtures, RefreshDatabase, VoucherAuthoringFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(now()->startOfSecond());
        config(['hub-routing.enabled' => true, 'services.geoapify.server_key' => 'test-key']);
        Http::preventStrayRequests();
        Http::fake(['api.geoapify.com/v1/routematrix*' => Http::response(['sources_to_targets' => [[['distance' => 1000, 'time' => 100]]]])]);
    }

    private function intent(array $context, array $vouchers = []): array
    {
        return [
            'mode' => 'buy_now', 'buy_now' => ['product_id' => $context['product']->id, 'variant_id' => null, 'quantity' => 2],
            'address_id' => $context['address']->id, 'payment_method' => 'cod',
            'logistics_selections' => [['shop_id' => $context['shop']->id, 'logistics_organization_id' => $context['origin'][1]->id]],
            'vouchers' => array_map(fn ($voucher) => ['voucher_id' => $voucher['id'], 'target_shop_id' => $context['shop']->id], $vouchers),
        ];
    }

    public function test_drafts_are_invisible_and_same_second_publication_and_availability_invalidate_quotes(): void
    {
        $context = $this->lifecycleContext(false);
        $admin = $this->voucherActor();
        $draft = $this->draftVoucher('admin', ['value' => 10]);
        $this->asLifecycleActor($context['customer']);
        $this->postJson('/api/v1/customer/checkout/quote', $this->intent($context))->assertOk()->assertJsonCount(0, 'data.groups.0.availableVouchers');
        $intent = $this->intent($context, [$draft]);
        $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertUnprocessable();
        $this->asLifecycleActor($admin);
        $live = $this->voucherAction($draft, 'publish')->assertOk()->json('data');
        $this->asLifecycleActor($context['customer']);
        $quote = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()->json('data');
        $this->asLifecycleActor($admin);
        $working = $this->withHeader('Idempotency-Key', (string) Str::uuid())->putJson('/api/v1/admin/vouchers/'.$live['id'].'/draft', $this->voucherTerms(['code' => $live['code'], 'revision' => $live['revision'], 'value' => 20]))->assertOk()->json('data');
        $replacement = $this->voucherAction($working, 'publish')->assertOk()->json('data');
        $this->asLifecycleActor($context['customer']);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/customer/checkout/place', [...$intent, 'quote_id' => $quote['quoteId']])->assertConflict()->assertJsonPath('code', 'QUOTE_STALE');
        $quote = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()->json('data');
        $this->asLifecycleActor($admin);
        $paused = $this->voucherAction($replacement, 'pause')->assertOk()->json('data');
        $this->voucherAction($paused, 'resume')->assertOk();
        $this->asLifecycleActor($context['customer']);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/customer/checkout/place', [...$intent, 'quote_id' => $quote['quoteId']])->assertConflict()->assertJsonPath('code', 'QUOTE_STALE');
        $this->assertDatabaseCount('voucher_redemptions', 0);
        $this->assertSame(0, Voucher::findOrFail($live['id'])->redeemed_count);
    }

    public function test_saving_a_working_draft_does_not_invalidate_the_live_quote(): void
    {
        $context = $this->lifecycleContext(false);
        $actor = $this->voucherActor();
        $voucher = $this->voucherAction($this->draftVoucher('admin', ['value' => 10]), 'publish')->assertOk()->json('data');
        $intent = $this->intent($context, [$voucher]);
        $this->asLifecycleActor($context['customer']);
        $quote = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()->json('data');
        $this->travel(2)->seconds();
        $this->asLifecycleActor($actor);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->putJson('/api/v1/admin/vouchers/'.$voucher['id'].'/draft', $this->voucherTerms(['code' => $voucher['code'], 'revision' => $voucher['revision'], 'value' => 50]))->assertOk();
        $this->asLifecycleActor($context['customer']);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/customer/checkout/place', [...$intent, 'quote_id' => $quote['quoteId']])->assertOk()->assertJsonPath('data.orders.0.vouchers.0.discountAmount', '10.00');
    }

    public function test_default_stacking_limits_and_immutable_redemption_report_after_cancellation(): void
    {
        $context = $this->lifecycleContext(false);
        $admin = $this->voucherActor();
        $shipping = $this->voucherAction($this->draftVoucher('admin', ['benefit_type' => 'shipping', 'value' => 5, 'stacking' => true, 'per_customer_limit' => 5]), 'publish')->assertOk()->json('data');
        $this->asLifecycleActor($context['seller']);
        $discount = $this->voucherAction($this->draftVoucher('seller', ['value_type' => 'percent', 'value' => 10]), 'publish', 'seller')->assertOk()->json('data');
        $intent = $this->intent($context, [$shipping, $discount]);
        $this->asLifecycleActor($context['customer']);
        $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()->assertJsonPath('data.summary.payable', '185.00');
        $this->asLifecycleActor($context['seller']);
        $working = $this->withHeader('Idempotency-Key', (string) Str::uuid())->putJson('/api/v1/seller/vouchers/'.$discount['id'].'/draft', $this->voucherTerms(['code' => $discount['code'], 'revision' => $discount['revision'], 'value_type' => 'percent', 'value' => 10, 'stacking' => true]))->assertOk()->json('data');
        $discount = $this->voucherAction($working, 'publish', 'seller')->assertOk()->json('data');
        $this->asLifecycleActor($context['customer']);
        $quote = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()->assertJsonPath('data.summary.payable', '185.00')->json('data');
        $batch = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/customer/checkout/place', [...$intent, 'quote_id' => $quote['quoteId']])->assertOk()->json('data');
        $order = Order::findOrFail($batch['orders'][0]['id']);
        $this->assertSame(18000, $order->pricingSnapshot->seller_proceeds_cents);
        $this->assertSame(1000, $order->pricingSnapshot->logistics_pool_cents);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/customer/orders/'.$order->id.'/cancel', ['reason' => 'Changed plans.'])->assertOk();
        $this->asLifecycleActor($context['seller']);
        $working = $this->withHeader('Idempotency-Key', (string) Str::uuid())->putJson('/api/v1/seller/vouchers/'.$discount['id'].'/draft', $this->voucherTerms(['code' => $discount['code'], 'revision' => $discount['revision'], 'value' => 40]))->assertOk()->json('data');
        $this->voucherAction($working, 'publish', 'seller')->assertOk()->assertJsonPath('data.redeemed_count', 1)->assertJsonPath('data.customer_savings', '20.00');
        $this->assertSame(['20.00', 2], [$order->vouchers()->where('voucher_id', $discount['id'])->sole()->discount_amount, $order->vouchers()->where('voucher_id', $discount['id'])->sole()->rule_version]);
        $report = $this->getJson('/api/v1/seller/vouchers/'.$discount['id'].'/redemptions')->assertOk()->assertJsonPath('data.0.order_status', 'cancelled')->assertJsonPath('data.0.version', 2)->json('data.0');
        $this->assertArrayNotHasKey('customer_id', $report);
        $this->assertSame($order->reference, $report['order_reference']);
        $this->asLifecycleActor($admin);
        $otherApp = $this->voucherAction($this->draftVoucher('admin', ['value' => 10, 'stacking' => true]), 'publish')->assertOk()->json('data');
        $this->asLifecycleActor($context['customer']);
        $this->postJson('/api/v1/customer/checkout/quote', $this->intent($context, [$shipping, $otherApp]))->assertOk()->assertJsonCount(2, 'data.groups.0.appliedVouchers');
    }
}
