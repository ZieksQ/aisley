<?php

namespace Tests\Feature\Vouchers;

use App\Models\Voucher;
use App\Models\VoucherClaim;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\Support\OrderLifecycleFixtures;
use Tests\Support\VoucherAuthoringFixtures;
use Tests\TestCase;

class VoucherNamesAndCapsTest extends TestCase
{
    use OrderLifecycleFixtures, RefreshDatabase, VoucherAuthoringFixtures;

    public function test_names_are_required_trimmed_searchable_and_versioned_for_both_roles(): void
    {
        foreach (['admin', 'seller'] as $role) {
            $this->voucherActor($role);
            foreach ([null, '', '   ', '<b>Sale</b>', str_repeat('x', 121)] as $name) {
                $this->withHeader('Idempotency-Key', (string) Str::uuid())
                    ->postJson('/api/v1/'.$role.'/vouchers', $this->voucherTerms(['name' => $name]))
                    ->assertUnprocessable()->assertJsonValidationErrors('name');
            }
            $draft = $this->draftVoucher($role, ['name' => '  Payday savings  ', 'stacking' => false]);
            $this->assertSame('Payday savings', $draft['name']);
            $this->assertSame(['app:shipping', 'shop:shipping'], $draft['terms']['stacking_policy']['allow_with']);
            $live = $this->voucherAction($draft, 'publish', $role)->assertOk()->json('data');
            $working = $this->withHeader('Idempotency-Key', (string) Str::uuid())
                ->putJson('/api/v1/'.$role.'/vouchers/'.$live['id'].'/draft', $this->voucherTerms([
                    'code' => $live['code'], 'revision' => $live['revision'], 'name' => 'Weekend savings',
                ]))->assertOk()->assertJsonPath('data.name', 'Payday savings')
                ->assertJsonPath('data.draft.terms.name', 'Weekend savings')->json('data');
            $this->voucherAction($working, 'publish', $role)->assertOk()->assertJsonPath('data.name', 'Weekend savings');
            $this->getJson('/api/v1/'.$role.'/vouchers?search=weekend')->assertOk()->assertJsonPath('meta.total', 1);
            $this->getJson('/api/v1/'.$role.'/vouchers/'.$live['id'].'/versions')
                ->assertOk()->assertJsonPath('data.1.terms.name', 'Payday savings');
        }
    }

    public function test_default_pairing_caps_and_immutable_names_through_checkout(): void
    {
        config(['hub-routing.enabled' => true, 'services.geoapify.server_key' => 'test-key']);
        Http::preventStrayRequests();
        Http::fake(['api.geoapify.com/v1/routematrix*' => Http::response(['sources_to_targets' => [[['distance' => 1000, 'time' => 100]]]])]);
        $context = $this->lifecycleContext(false);
        $admin = $this->voucherActor();
        $discount = $this->voucherAction($this->draftVoucher('admin', [
            'name' => 'Capped discount', 'value_type' => 'percent', 'value' => 20, 'maximum_discount' => 15,
        ]), 'publish')->assertOk()->json('data');
        $shipping = $this->voucherAction($this->draftVoucher('admin', [
            'name' => 'Capped shipping', 'benefit_type' => 'shipping', 'value' => 100, 'maximum_discount' => 3,
        ]), 'publish')->assertOk()->json('data');
        // Existing empty/false policies must also get the new default pairing behavior.
        Voucher::whereIn('id', [$discount['id'], $shipping['id']])->update(['stacking_policy' => null]);
        $intent = [
            'mode' => 'buy_now', 'buy_now' => ['product_id' => $context['product']->id, 'variant_id' => null, 'quantity' => 2],
            'address_id' => $context['address']->id, 'payment_method' => 'cod',
            'logistics_selections' => [['shop_id' => $context['shop']->id, 'logistics_organization_id' => $context['origin'][1]->id]],
            'vouchers' => array_map(fn ($voucher) => ['voucher_id' => $voucher['id'], 'target_shop_id' => $context['shop']->id], [$discount, $shipping]),
        ];
        $this->asLifecycleActor($context['customer']);
        $quote = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()
            ->assertJsonPath('data.summary.discount', '15.00')->assertJsonPath('data.summary.shippingDiscount', '3.00')
            ->assertJsonPath('data.summary.payable', '192.00')->json('data');
        $batch = $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/customer/checkout/place', [...$intent, 'quote_id' => $quote['quoteId']])->assertOk()->json('data');
        $this->assertSame(['Capped discount', 'Capped shipping'], array_column($batch['orders'][0]['vouchers'], 'name'));
        $this->asLifecycleActor($admin);
        $other = $this->voucherAction($this->draftVoucher('admin'), 'publish')->assertOk()->json('data');
        $otherShipping = $this->voucherAction($this->draftVoucher('admin', ['benefit_type' => 'shipping']), 'publish')->assertOk()->json('data');
        $this->asLifecycleActor($context['customer']);
        foreach ([[$discount, $other], [$shipping, $otherShipping]] as $pair) {
            $selection = array_map(fn ($voucher) => ['voucher_id' => $voucher['id'], 'target_shop_id' => $context['shop']->id], $pair);
            // Raise exhausted per-Customer limits to isolate the same-benefit gate.
            Voucher::whereIn('id', array_column($pair, 'id'))->update(['per_customer_limit' => 10]);
            $this->postJson('/api/v1/customer/checkout/quote', [...$intent, 'vouchers' => $selection])
                ->assertUnprocessable()->assertJsonPath('code', 'APP_VOUCHER_LIMIT');
        }
        $this->asLifecycleActor($context['seller']);
        $shopDiscount = $this->voucherAction($this->draftVoucher('seller'), 'publish', 'seller')->assertOk()->json('data');
        $this->asLifecycleActor($context['customer']);
        VoucherClaim::create(['voucher_id' => $shopDiscount['id'], 'customer_id' => $context['customer']->id, 'collected_at' => now()]);
        foreach ([[$other, $shopDiscount], [$shopDiscount, $other]] as $pair) {
            $selection = array_map(fn ($voucher) => ['voucher_id' => $voucher['id'], 'target_shop_id' => $context['shop']->id], $pair);
            $this->postJson('/api/v1/customer/checkout/quote', [...$intent, 'vouchers' => $selection])
                ->assertUnprocessable()->assertJsonPath('code', 'VOUCHER_BENEFIT_LIMIT');
        }
        Voucher::findOrFail($discount['id'])->update(['name' => 'Changed later']);
        $this->getJson('/api/v1/customer/checkout/'.$batch['id'])->assertOk()
            ->assertJsonPath('data.orders.0.vouchers.0.name', 'Capped discount');
    }

    public function test_name_migration_backfills_projection_without_rewriting_published_versions(): void
    {
        $this->voucherActor();
        $live = $this->voucherAction($this->draftVoucher(), 'publish')->assertOk()->json('data');
        $before = Voucher::findOrFail($live['id'])->versions()->sole()->terms;
        $migration = require database_path('migrations/2026_10_09_000001_add_voucher_names.php');
        $migration->down();
        $migration->up();
        $voucher = Voucher::findOrFail($live['id']);
        $this->assertSame($voucher->code, $voucher->name);
        $this->assertSame($before, $voucher->versions()->sole()->terms);
    }

    public function test_caps_rounding_and_basis_clamps_for_fixed_and_percentage_benefits(): void
    {
        config(['hub-routing.enabled' => true, 'services.geoapify.server_key' => 'test-key']);
        Http::preventStrayRequests();
        Http::fake(['api.geoapify.com/v1/routematrix*' => Http::response(['sources_to_targets' => [[['distance' => 1000, 'time' => 100]]]])]);
        $context = $this->lifecycleContext(false);
        $admin = $this->voucherActor();
        foreach ([
            ['discount', 'fixed', '100', '15', '15.00'],
            ['discount', 'fixed', '300', null, '200.00'],
            ['discount', 'percent', '33.33', null, '66.66'],
            ['discount', 'percent', '33.33', '10.01', '10.01'],
            ['shipping', 'percent', '33.35', null, '3.34'],
            ['shipping', 'percent', '100', '5', '5.00'],
            ['shipping', 'fixed', '100', null, '10.00'],
        ] as [$benefit, $type, $value, $cap, $expected]) {
            $this->asLifecycleActor($admin);
            $live = $this->voucherAction($this->draftVoucher('admin', [
                'benefit_type' => $benefit, 'value_type' => $type, 'value' => $value, 'maximum_discount' => $cap,
            ]), 'publish')->assertOk()->json('data');
            $this->asLifecycleActor($context['customer']);
            $this->postJson('/api/v1/customer/checkout/quote', [
                'mode' => 'buy_now', 'buy_now' => ['product_id' => $context['product']->id, 'variant_id' => null, 'quantity' => 2],
                'address_id' => $context['address']->id, 'payment_method' => 'cod',
                'logistics_selections' => [['shop_id' => $context['shop']->id, 'logistics_organization_id' => $context['origin'][1]->id]],
                'vouchers' => [['voucher_id' => $live['id'], 'target_shop_id' => $context['shop']->id]],
            ])->assertOk()->assertJsonPath('data.groups.0.appliedVouchers.0.discountAmount', $expected);
        }
    }
}
