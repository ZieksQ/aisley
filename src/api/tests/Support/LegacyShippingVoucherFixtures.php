<?php

namespace Tests\Support;

use App\Models\CommissionPolicy;
use App\Models\Voucher;
use App\Models\VoucherClaim;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

trait LegacyShippingVoucherFixtures
{
    use OrderLifecycleFixtures;

    private function legacyContext(string $price = '10.00'): array
    {
        Queue::fake();
        Http::preventStrayRequests();
        config(['finance.gateway_enabled' => true, 'hub-routing.enabled' => true, 'services.geoapify.server_key' => 'test-key']);
        Http::fake(['api.geoapify.com/v1/routematrix*' => Http::response(['sources_to_targets' => [[['distance' => 1000, 'time' => 100]]]])]);
        $context = $this->lifecycleContext(false);
        $context['product']->update(['price' => $price]);
        $context['origin'][1]->rateCards()->sole()->services()->where('service_type', 'first_mile')->update(['base_fee_cents' => 800]);
        $context['origin'][1]->rateCards()->sole()->services()->where('service_type', 'last_mile')->update(['base_fee_cents' => 1200]);
        CommissionPolicy::query()->update(['rate_basis_points' => 1000]);
        $this->asLifecycleActor($context['customer']);

        return $context;
    }

    private function legacyVoucher(array $context, array $overrides = []): Voucher
    {
        // Persisted imports can contain terms that current Seller authoring forbids.
        $voucher = new Voucher(array_replace([
            'name' => 'Legacy shipping', 'code' => 'LEGACY-'.Str::upper(Str::random(8)),
            'issuer_type' => 'shop', 'shop_id' => $context['shop']->id,
            'benefit_type' => 'shipping', 'value_type' => 'fixed', 'value' => '9.00',
            'minimum_spend' => '0.00', 'starts_at' => now()->subDay(), 'ends_at' => now()->addDay(),
            'per_customer_limit' => 5, 'redeemed_count' => 0, 'payment_method' => 'cod',
            'eligibility_rules' => [], 'stacking_policy' => [], 'terms_summary' => 'Legacy full shipping saving.',
            'is_active' => true, 'lifecycle' => 'published', 'version' => 1,
        ], $overrides));
        if (isset($overrides['id'])) {
            $voucher->forceFill(['id' => $overrides['id']]);
        }
        $voucher->save();

        VoucherClaim::create(['voucher_id' => $voucher->id, 'customer_id' => $context['customer']->id, 'collected_at' => now()]);

        return $voucher;
    }

    private function legacyIntent(array $context, array $vouchers = []): array
    {
        return [
            'mode' => 'buy_now', 'buy_now' => ['product_id' => $context['product']->id, 'variant_id' => null, 'quantity' => 1],
            'address_id' => $context['address']->id, 'payment_method' => 'cod',
            'logistics_selections' => [['shop_id' => $context['shop']->id, 'logistics_organization_id' => $context['origin'][1]->id]],
            'vouchers' => array_map(fn (Voucher $voucher) => ['voucher_id' => $voucher->id, 'target_shop_id' => $context['shop']->id], $vouchers),
        ];
    }
}
