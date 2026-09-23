<?php

namespace App\Services\Finance;

use App\Exceptions\Customer\CheckoutException;
use App\Models\CommissionPolicy;
use App\Models\Order;
use App\Models\OrderPricingSnapshot;

class OrderPricingService
{
    /** @param array<string, mixed> $group @return array<string, mixed> */
    public function calculate(array $group): array
    {
        $sellerPolicy = $this->policy('seller');
        $logisticsPolicy = $this->policy('logistics');
        $sellerMerchandiseDiscount = collect($group['applied_vouchers'])
            ->filter(fn (array $entry) => $entry['voucher']->issuer_type->value === 'shop' && $entry['voucher']->benefit_type->value === 'discount')
            ->sum('discount_cents');
        $sellerShippingDiscount = collect($group['applied_vouchers'])
            ->filter(fn (array $entry) => $entry['voucher']->issuer_type->value === 'shop' && $entry['voucher']->benefit_type->value === 'shipping')
            ->sum('discount_cents');
        $base = max(0, $group['subtotal_cents'] - $sellerMerchandiseDiscount);
        $sellerCommission = $this->percentage($base, $sellerPolicy->rate_basis_points);
        $shippingBudget = $group['shipping_cents'] + ($group['shipping_subsidy_cents'] ?? 0);
        $logisticsCommission = $this->percentage($shippingBudget, $logisticsPolicy->rate_basis_points);

        return [
            'seller_policy' => $sellerPolicy, 'logistics_policy' => $logisticsPolicy,
            'seller_commission_base_cents' => $base, 'seller_commission_cents' => $sellerCommission,
            'seller_proceeds_cents' => max(0, $base - $sellerCommission - $sellerShippingDiscount),
            'logistics_commission_cents' => $logisticsCommission,
            'logistics_pool_cents' => max(0, $shippingBudget - $logisticsCommission),
            'voucher_funding' => collect($group['applied_vouchers'])->map(fn (array $entry) => [
                'voucher_id' => $entry['voucher']->id, 'issuer' => $entry['voucher']->issuer_type->value,
                'benefit' => $entry['voucher']->benefit_type->value, 'amount_cents' => $entry['discount_cents'],
            ])->values()->all(),
        ];
    }

    /** @param array<string, mixed> $group */
    public function snapshot(Order $order, array $group): OrderPricingSnapshot
    {
        $pricing = $group['finance'];
        $shipping = $group['shipping_quote'];

        return OrderPricingSnapshot::create([
            'order_id' => $order->id, 'shipping_rate_version_id' => $shipping['rate']->id,
            'seller_commission_policy_id' => $pricing['seller_policy']->id,
            'logistics_commission_policy_id' => $pricing['logistics_policy']->id, 'currency' => $order->currency,
            'billable_weight_grams' => $shipping['billable_weight_grams'], 'base_fee_cents' => $shipping['base_fee_cents'],
            'additional_weight_fee_cents' => $shipping['additional_weight_fee_cents'],
            'destination_surcharge_cents' => $shipping['destination_surcharge_cents'],
            'quoted_shipping_fee_cents' => $group['shipping_cents'], 'shipping_subsidy_cents' => $group['shipping_subsidy_cents'] ?? 0,
            'seller_commission_base_cents' => $pricing['seller_commission_base_cents'],
            'seller_commission_cents' => $pricing['seller_commission_cents'], 'seller_proceeds_cents' => $pricing['seller_proceeds_cents'],
            'logistics_commission_cents' => $pricing['logistics_commission_cents'], 'logistics_pool_cents' => $pricing['logistics_pool_cents'],
            'cod_total_cents' => $group['payable_cents'], 'origin_snapshot' => $shipping['origin'],
            'destination_snapshot' => $shipping['destination'], 'line_inputs' => $shipping['line_inputs'],
            'voucher_funding' => $pricing['voucher_funding'],
            'eligible_logistics_organization_ids' => $shipping['eligible_logistics_organization_ids'], 'snapshotted_at' => now(),
        ]);
    }

    private function policy(string $type): CommissionPolicy
    {
        $policy = CommissionPolicy::query()->where('beneficiary_type', $type)->where('status', 'published')
            ->where('effective_at', '<=', now())->where(fn ($query) => $query->whereNull('ends_at')->orWhere('ends_at', '>', now()))
            ->orderByDesc('effective_at')->orderByDesc('revision')->first();
        if ($policy === null) {
            throw CheckoutException::conflict('COMMISSION_POLICY_UNAVAILABLE', "The {$type} commission rate is not active.");
        }

        return $policy;
    }

    private function percentage(int $amount, int $basisPoints): int
    {
        return intdiv(($amount * $basisPoints) + 5000, 10000);
    }
}
