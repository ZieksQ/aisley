<?php

namespace App\Services\Finance;

use App\Models\Order;
use App\Models\Shipment;

class FinanceLifecycleService
{
    public function __construct(private readonly LedgerService $ledger, private readonly LogisticsAllocationService $allocation) {}

    public function recognizeDelivery(Order $order, Shipment $shipment, mixed $deliveredAt): void
    {
        $order->loadMissing(['shop', 'pricingSnapshot', 'items']);
        $snapshot = $order->pricingSnapshot;
        if ($snapshot === null) {
            return;
        }
        $allocation = $this->allocation->allocate($order, $shipment, $snapshot->logistics_pool_cents);
        $platformVoucherExpense = collect($snapshot->voucher_funding)
            ->where('issuer', 'app')->sum('amount_cents');
        $lines = [[
            'account_code' => 'cod_receivable', 'owner_type' => 'platform', 'debit_cents' => $snapshot->cod_total_cents,
        ]];
        if ($platformVoucherExpense > 0) {
            $lines[] = ['account_code' => 'voucher_expense', 'owner_type' => 'platform', 'debit_cents' => $platformVoucherExpense];
        }
        if ($snapshot->shipping_subsidy_cents > 0) {
            $lines[] = ['account_code' => 'shipping_subsidy_expense', 'owner_type' => 'platform', 'debit_cents' => $snapshot->shipping_subsidy_cents];
        }
        $knownProductCost = $order->items->filter(fn ($item) => $item->unit_cost_cents !== null)
            ->sum(fn ($item) => $item->unit_cost_cents * $item->quantity);
        if ($knownProductCost > 0) {
            $lines[] = ['account_code' => 'product_cost', 'owner_type' => 'seller', 'owner_id' => $order->shop_id, 'debit_cents' => $knownProductCost];
            $lines[] = ['account_code' => 'inventory_asset', 'owner_type' => 'seller', 'owner_id' => $order->shop_id, 'credit_cents' => $knownProductCost];
        }
        if ($snapshot->seller_proceeds_cents > 0) {
            $lines[] = ['account_code' => 'seller_liability', 'owner_type' => 'seller', 'owner_id' => $order->shop_id, 'credit_cents' => $snapshot->seller_proceeds_cents];
        }
        if ($allocation['held']) {
            if ($snapshot->logistics_pool_cents > 0) {
                $lines[] = ['account_code' => 'logistics_allocation_pending', 'owner_type' => 'platform', 'credit_cents' => $snapshot->logistics_pool_cents];
            }
        } else {
            $this->allocation->commit($order, $allocation['allocations']);
            foreach (collect($allocation['allocations'])->groupBy('organization_id') as $organizationId => $shares) {
                $amount = $shares->sum('amount_cents');
                if ($amount > 0) {
                    $lines[] = ['account_code' => 'logistics_liability', 'owner_type' => 'logistics', 'owner_id' => $organizationId, 'credit_cents' => $amount];
                }
            }
        }
        $commission = $snapshot->seller_commission_cents + $snapshot->logistics_commission_cents;
        if ($commission > 0) {
            $lines[] = ['account_code' => 'commission_revenue', 'owner_type' => 'platform', 'credit_cents' => $commission];
        }
        if (collect($lines)->sum('debit_cents') === 0 && collect($lines)->sum('credit_cents') === 0) {
            return;
        }
        $this->ledger->post('delivery:'.$order->id, 'delivery_recognized', $order->currency, $lines, $deliveredAt, $order->id, 'Revenue and beneficiary liabilities recognized at confirmed delivery.');
    }
}
