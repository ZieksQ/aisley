<?php

namespace Tests\Feature\Finance;

use App\Exceptions\Customer\CheckoutException;
use App\Models\CommissionPolicy;
use App\Models\Voucher;
use App\Services\Finance\OrderPricingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use LogicException;
use Tests\TestCase;

class OrderPricingFundingTest extends TestCase
{
    use RefreshDatabase;

    public function test_pricing_domain_rejects_a_shortfall_without_checkout_or_ledger(): void
    {
        $this->policies();
        $group = $this->group(1000, 2000, 2000);
        try {
            app(OrderPricingService::class)->calculate($group);
            $this->fail('The audit shortfall must be rejected by the pricing domain.');
        } catch (CheckoutException $exception) {
            $this->assertSame(['VOUCHER_FUNDING_INSUFFICIENT', 409, 'vouchers'], [$exception->errorCode, $exception->status, $exception->field]);
        }
        $this->assertDatabaseCount('order_pricing_snapshots', 0);
    }

    public function test_pricing_conserves_every_cent_with_app_funding_and_explicit_subsidy(): void
    {
        $this->policies();
        $group = $this->group(1005, 2000, 904);
        $group['applied_vouchers'][] = [
            'voucher' => new Voucher(['issuer_type' => 'app', 'benefit_type' => 'discount']), 'discount_cents' => 1005,
        ];
        $group['payable_cents'] = 1096;
        $group['shipping_subsidy_cents'] = 5;
        $pricing = app(OrderPricingService::class)->calculate($group);
        $this->assertSame([101, 0, 201, 1804], [$pricing['seller_commission_cents'], $pricing['seller_proceeds_cents'], $pricing['logistics_commission_cents'], $pricing['logistics_pool_cents']]);
        $this->assertSame(2106, $pricing['seller_proceeds_cents'] + $pricing['seller_commission_cents'] + $pricing['logistics_commission_cents'] + $pricing['logistics_pool_cents']);
    }

    public function test_pricing_rejects_inconsistent_payable_even_when_the_voucher_is_funded(): void
    {
        $this->policies();
        $group = $this->group(1000, 2000, 900);
        $group['payable_cents']--;
        $this->expectException(LogicException::class);
        app(OrderPricingService::class)->calculate($group);
    }

    private function policies(): void
    {
        foreach (['seller', 'logistics'] as $type) {
            CommissionPolicy::create(['beneficiary_type' => $type, 'rate_basis_points' => 1000, 'status' => 'published', 'effective_at' => now()->subDay()]);
        }
    }

    private function group(int $subtotal, int $shipping, int $saving): array
    {
        return [
            'subtotal_cents' => $subtotal, 'shipping_cents' => $shipping, 'payable_cents' => $subtotal + $shipping - $saving,
            'applied_vouchers' => [[
                'voucher' => new Voucher(['issuer_type' => 'shop', 'benefit_type' => 'shipping']), 'discount_cents' => $saving,
            ]],
        ];
    }
}
