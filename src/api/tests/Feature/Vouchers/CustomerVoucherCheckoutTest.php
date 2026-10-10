<?php

namespace Tests\Feature\Vouchers;

use App\Models\User;
use App\Models\Voucher;
use App\Models\VoucherClaim;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\Support\OrderLifecycleFixtures;
use Tests\Support\VoucherAuthoringFixtures;
use Tests\TestCase;

class CustomerVoucherCheckoutTest extends TestCase
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

    private function intent(array $context, array $voucher): array
    {
        return [
            'mode' => 'buy_now', 'buy_now' => ['product_id' => $context['product']->id, 'variant_id' => null, 'quantity' => 1],
            'address_id' => $context['address']->id, 'payment_method' => 'cod',
            'logistics_selections' => [['shop_id' => $context['shop']->id, 'logistics_organization_id' => $context['origin'][1]->id]],
            'vouchers' => [['voucher_id' => $voucher['id'], 'target_shop_id' => $context['shop']->id]],
        ];
    }

    public function test_platform_claim_is_owned_and_required_at_quote_and_placement_without_changing_capacity(): void
    {
        $context = $this->lifecycleContext(false);
        $this->voucherActor();
        $voucher = $this->voucherAction($this->draftVoucher('admin', ['distribution_mode' => 'claim_required', 'value' => 10]), 'publish')->assertOk()->json('data');
        $intent = $this->intent($context, $voucher);
        $other = User::factory()->create(['role' => 'customer', 'status' => 'active']);
        VoucherClaim::create(['customer_id' => $other->id, 'voucher_id' => $voucher['id'], 'collected_at' => now()]);
        $this->asLifecycleActor($context['customer']);
        $this->postJson('/api/v1/customer/checkout/quote', [...$intent, 'vouchers' => []])->assertOk()
            ->assertJsonPath('data.groups.0.availableVouchers.0.reason', 'VOUCHER_NOT_CLAIMED')
            ->assertJsonPath('data.groups.0.availableVouchers.0.collectionUrl', '/vouchers/'.$voucher['id']);
        $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertConflict()->assertJsonPath('code', 'VOUCHER_NOT_CLAIMED');
        $this->postJson('/api/v1/customer/vouchers/'.$voucher['id'].'/claim')->assertOk();
        $this->assertSame(0, Voucher::findOrFail($voucher['id'])->redeemed_count);
        $quote = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()->json('data');
        VoucherClaim::where('customer_id', $context['customer']->id)->delete();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/customer/checkout/place', [...$intent, 'quote_id' => $quote['quoteId']])->assertConflict()->assertJsonPath('code', 'QUOTE_STALE');
        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('voucher_redemptions', 0);
    }

    public function test_shop_claim_allows_partial_usage_then_history_and_committed_replay_after_ending(): void
    {
        $context = $this->lifecycleContext(false);
        $this->asLifecycleActor($context['seller']);
        $voucher = $this->voucherAction($this->draftVoucher('seller', ['value' => 10, 'per_customer_limit' => 2]), 'publish', 'seller')->assertOk()->json('data');
        $intent = $this->intent($context, $voucher);
        $this->asLifecycleActor($context['customer']);
        $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertConflict()->assertJsonPath('code', 'VOUCHER_NOT_CLAIMED');
        $this->postJson('/api/v1/customer/shops/'.$context['shop']->slug.'/vouchers/'.$voucher['id'].'/claim')->assertOk();
        for ($use = 1; $use <= 2; $use++) {
            $quote = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()->json('data');
            $key = (string) Str::uuid();
            $payload = [...$intent, 'quote_id' => $quote['quoteId']];
            $batch = $this->withHeader('Idempotency-Key', $key)->postJson('/api/v1/customer/checkout/place', $payload)->assertOk()->json('data');
            $this->getJson('/api/v1/customer/my-vouchers?status='.($use === 1 ? 'available' : 'history'))->assertOk()
                ->assertJsonPath('items.0.remainingPersonalUses', 2 - $use)->assertJsonPath('items.0.walletStatus', $use === 1 ? 'available' : 'history');
        }
        $this->postJson('/api/v1/customer/vouchers/'.$voucher['id'].'/claim')->assertNotFound();
        Voucher::findOrFail($voucher['id'])->update(['lifecycle' => 'ended', 'is_active' => false]);
        $this->withHeader('Idempotency-Key', $key)->postJson('/api/v1/customer/checkout/place', $payload)->assertOk()->assertJsonPath('data.id', $batch['id']);
        $this->assertDatabaseCount('voucher_redemptions', 2);
        $this->assertDatabaseCount('voucher_claims', 1);
        $this->getJson('/api/v1/customer/my-vouchers?status=history')->assertOk()->assertJsonPath('items.0.availabilityReason', 'VOUCHER_ENDED');
    }

    public function test_automatic_platform_access_and_placement_recheck_after_pause(): void
    {
        $context = $this->lifecycleContext(false);
        $actor = $this->voucherActor();
        $voucher = $this->voucherAction($this->draftVoucher('admin', ['distribution_mode' => 'automatic', 'value' => 10]), 'publish')->assertOk()->json('data');
        $this->asLifecycleActor($context['customer']);
        $intent = $this->intent($context, $voucher);
        $quote = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()->json('data');
        $this->assertDatabaseCount('voucher_claims', 0);
        $this->asLifecycleActor($actor);
        $this->voucherAction($voucher, 'pause')->assertOk();
        $this->asLifecycleActor($context['customer']);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/customer/checkout/place', [...$intent, 'quote_id' => $quote['quoteId']])->assertConflict()->assertJsonPath('code', 'QUOTE_STALE');
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_distribution_defaults_versions_lock_and_duplication(): void
    {
        $this->voucherActor();
        $draft = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/admin/vouchers', $this->voucherTerms())->assertCreated()
            ->assertJsonPath('data.draft.terms.distribution_mode', 'claim_required')->json('data');
        $live = $this->voucherAction($draft, 'publish')->assertOk()->assertJsonPath('data.terms.distribution_mode', 'claim_required')->json('data');
        $this->assertSame('claim_required', Voucher::findOrFail($live['id'])->versions()->sole()->terms['distribution_mode']);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->putJson('/api/v1/admin/vouchers/'.$live['id'].'/draft', $this->voucherTerms(['revision' => $live['revision'], 'code' => $live['code'], 'distribution_mode' => 'automatic']))->assertUnprocessable();
        $copy = $this->voucherAction($live, 'duplicate')->assertCreated()->assertJsonPath('data.terms.distribution_mode', 'claim_required')->json('data');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->putJson('/api/v1/admin/vouchers/'.$copy['id'].'/draft', $this->voucherTerms(['revision' => $copy['revision'], 'code' => $copy['code'], 'distribution_mode' => 'automatic']))->assertOk()->assertJsonPath('data.draft.terms.distribution_mode', 'automatic');
        $this->voucherActor('seller');
        $seller = $this->draftVoucher('seller');
        $this->assertSame('claim_required', $seller['draft']['terms']['distribution_mode']);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/seller/vouchers', $this->voucherTerms(['distribution_mode' => 'automatic']))->assertUnprocessable();
    }
}
