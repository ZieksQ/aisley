<?php

namespace App\Services\Customer;

use App\Exceptions\Customer\CheckoutException;
use App\Models\Address;
use App\Models\CommissionPolicy;
use App\Models\Order;
use App\Models\OrderPricingSnapshot;
use App\Services\Finance\OrderSnapshotFunding;
use App\Services\Finance\ShippingQuotationService;

class OrderAddressPricing
{
    public function __construct(private readonly ShippingQuotationService $shipping) {}

    /**
     * Build an unsaved successor using committed merchandise, parcel and discount facts.
     *
     * @return array{snapshot: OrderPricingSnapshot, state: array<string, mixed>}
     */
    public function calculate(Order $order, Address $address): array
    {
        $current = $order->pricingSnapshot;
        if ($current === null || $order->selected_logistics_organization_id === null
            || ! $current->line_inputs || ! $current->origin_snapshot) {
            throw CheckoutException::conflict('ORDER_PRICING_UNAVAILABLE', 'This Order does not have complete stored delivery pricing. Contact details can still be corrected at the same location.');
        }
        $quote = $this->shipping->quote($order->shop, $address, [], $order->selected_logistics_organization_id, $current);
        if (! in_array($quote['route_snapshot']['status'], ['local', 'planned'], true)) {
            throw CheckoutException::conflict('SHIPPING_COVERAGE_UNAVAILABLE', 'The current delivery provider cannot deliver to this address. Choose another saved address.', 'address_id');
        }
        $policy = CommissionPolicy::find($current->logistics_commission_policy_id);
        if ($policy === null || $current->currency !== $quote['rate']->currency) {
            throw CheckoutException::conflict('ORDER_PRICING_UNAVAILABLE', 'The stored delivery pricing cannot be revised.');
        }
        $shipping = $quote['shipping_cents'];
        $saving = min($this->cents($order->shipping_discount_total), $shipping);
        $funding = $current->voucher_funding ?? [];
        // Keep the original issuer and redemption; a shipping saving can only decrease.
        $remaining = $saving;
        foreach ($funding as &$entry) {
            if ($entry['benefit'] === 'shipping') {
                $entry['amount_cents'] = min((int) $entry['amount_cents'], $remaining);
                $remaining -= $entry['amount_cents'];
            }
        }
        unset($entry);
        if ($remaining !== 0) {
            throw CheckoutException::conflict('ORDER_PRICING_UNAVAILABLE', 'The stored shipping saving cannot be verified.');
        }
        $sellerShipping = collect($funding)->where('issuer', 'shop')->where('benefit', 'shipping')->sum('amount_cents');
        $budget = $shipping + $current->shipping_subsidy_cents;
        $commission = intdiv($budget * $policy->rate_basis_points + 5000, 10000);
        $next = $current->replicate()->fill([
            'version' => $current->version + 1,
            'address_version' => $order->address->version + 1,
            'shipping_rate_version_id' => $quote['rate']->id,
            'shipping_pricing_model' => $quote['pricing_model'],
            'shipping_route_status' => $quote['route_snapshot']['status'],
            'shipping_route_snapshot' => $quote['route_snapshot'],
            'billable_weight_grams' => $quote['billable_weight_grams'],
            'base_fee_cents' => $quote['base_fee_cents'],
            'additional_weight_fee_cents' => $quote['additional_weight_fee_cents'],
            'destination_surcharge_cents' => $quote['destination_surcharge_cents'],
            'quoted_shipping_fee_cents' => $shipping,
            'seller_proceeds_cents' => $current->seller_commission_base_cents - $current->seller_commission_cents - $sellerShipping,
            'logistics_commission_cents' => $commission,
            'logistics_pool_cents' => $budget - $commission,
            'cod_total_cents' => $this->cents($order->merchandise_subtotal) - $this->cents($order->discount_total) + $shipping - $saving,
            'destination_snapshot' => $quote['destination'],
            'line_inputs' => $quote['line_inputs'],
            'logistics_charge_inputs' => $quote['logistics_charge_inputs'],
            'voucher_funding' => $funding,
            'eligible_logistics_organization_ids' => $quote['eligible_logistics_organization_ids'],
        ]);
        app(OrderSnapshotFunding::class)->assertBalanced($next);

        return ['snapshot' => $next, 'state' => $quote['state']];
    }

    public function cents(string $amount): int
    {
        [$whole, $fraction] = array_pad(explode('.', $amount, 2), 2, '');

        return (int) $whole * 100 + (int) str_pad($fraction, 2, '0');
    }

    public function money(int $cents): string
    {
        return intdiv($cents, 100).'.'.str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT);
    }
}
