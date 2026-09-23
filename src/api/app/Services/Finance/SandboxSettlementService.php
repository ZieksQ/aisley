<?php

namespace App\Services\Finance;

use App\Models\FinancePayout;
use App\Models\FinancePayoutItem;
use App\Models\FinanceSandboxBeneficiaryAccount;
use App\Models\Order;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class SandboxSettlementService
{
    public function __construct(private readonly LedgerService $ledger) {}

    public function run(): int
    {
        $cutoff = CarbonImmutable::now()->subDays(14);
        $obligations = [];
        $orders = Order::query()->where('status', 'delivered')->whereHas('statusEvents', fn ($query) => $query->where('to_status', 'delivered')->where('occurred_at', '<=', $cutoff))
            ->whereHas('pricingSnapshot')
            ->with(['pricingSnapshot', 'statusEvents', 'shop', 'waybill.parcel.shipment'])
            ->whereDoesntHave('statusEvents', fn ($query) => $query->where('to_status', 'cancelled'))
            ->get();
        foreach ($orders as $order) {
            $snapshot = $order->pricingSnapshot;
            if ($snapshot === null || DB::table('financial_holds')->where('order_id', $order->id)->whereNull('released_at')->exists() || ! $this->fullyRemitted($order)) {
                continue;
            }
            $this->addObligation($obligations, $order, 'seller', $order->shop_id, $snapshot->seller_proceeds_cents);
            $allocations = DB::table('logistics_service_allocations')->where('order_id', $order->id)->where('status', 'committed')->selectRaw('logistics_organization_id, SUM(amount_cents) AS amount')->groupBy('logistics_organization_id')->get();
            foreach ($allocations as $allocation) {
                $this->addObligation($obligations, $order, 'logistics', $allocation->logistics_organization_id, (int) $allocation->amount);
            }
        }

        $created = 0;
        foreach ($obligations as $group) {
            $payout = $this->reserve($group, $cutoff);
            if ($payout === null) {
                continue;
            }
            $created++;
            $this->simulate($payout);
        }

        return $created;
    }

    public function callback(string $providerReference, string $outcome): FinancePayout
    {
        return DB::transaction(function () use ($providerReference, $outcome): FinancePayout {
            $payout = FinancePayout::query()->where('provider_reference', $providerReference)->lockForUpdate()->firstOrFail();
            if (in_array($payout->status, ['succeeded', 'failed'], true)) {
                return $payout;
            }
            if ($outcome === 'success') {
                $this->ledger->post('payout-resolve:'.$payout->id, 'sandbox_payout_succeeded', $payout->currency, [
                    ['account_code' => 'payout_payable', 'owner_type' => $payout->beneficiary_type, 'owner_id' => $payout->beneficiary_id, 'debit_cents' => $payout->amount_cents],
                    ['account_code' => 'cash', 'owner_type' => 'platform', 'credit_cents' => $payout->amount_cents],
                ], now(), null, 'Sandbox payout completed.');
                $payout->update(['status' => 'succeeded', 'resolved_at' => now()]);
            } elseif (in_array($outcome, ['failure', 'insufficient_funds'], true)) {
                $this->ledger->post('payout-reverse:'.$payout->id, 'sandbox_payout_failed', $payout->currency, [
                    ['account_code' => 'payout_payable', 'owner_type' => $payout->beneficiary_type, 'owner_id' => $payout->beneficiary_id, 'debit_cents' => $payout->amount_cents],
                    ['account_code' => $payout->beneficiary_type.'_liability', 'owner_type' => $payout->beneficiary_type, 'owner_id' => $payout->beneficiary_id, 'credit_cents' => $payout->amount_cents],
                ], now(), null, 'Sandbox payout reservation reversed.');
                $payout->update(['status' => 'failed', 'resolved_at' => now()]);
                $payout->items()->delete();
            }

            return $payout->refresh();
        }, 3);
    }

    /** @param array<string, mixed> $obligations */
    private function addObligation(array &$obligations, Order $order, string $type, string $id, int $amount): void
    {
        if ($amount < 1 || FinancePayoutItem::query()->where('order_id', $order->id)->where('beneficiary_type', $type)->where('beneficiary_id', $id)->exists()) {
            return;
        }
        $key = $type.':'.$id.':'.$order->currency;
        $obligations[$key] ??= ['beneficiary_type' => $type, 'beneficiary_id' => $id, 'currency' => $order->currency, 'items' => []];
        $obligations[$key]['items'][] = ['order_id' => $order->id, 'amount_cents' => $amount];
    }

    /** @param array<string, mixed> $group */
    private function reserve(array $group, CarbonImmutable $cutoff): ?FinancePayout
    {
        return DB::transaction(function () use ($group, $cutoff): ?FinancePayout {
            $account = FinanceSandboxBeneficiaryAccount::query()->firstOrCreate([
                'beneficiary_type' => $group['beneficiary_type'], 'beneficiary_id' => $group['beneficiary_id'],
            ], ['account_reference' => 'sandbox-'.substr($group['beneficiary_id'], 0, 12), 'scenario' => 'success', 'is_active' => true]);
            $itemIds = collect($group['items'])->pluck('order_id')->sort()->values()->all();
            $key = hash('sha256', implode('|', [$group['beneficiary_type'], $group['beneficiary_id'], $group['currency'], ...$itemIds]));
            if (FinancePayout::query()->where('idempotency_key', $key)->exists()) {
                return null;
            }
            $amount = collect($group['items'])->sum('amount_cents');
            $payout = FinancePayout::create([
                'beneficiary_type' => $group['beneficiary_type'], 'beneficiary_id' => $group['beneficiary_id'],
                'sandbox_beneficiary_account_id' => $account->id, 'currency' => $group['currency'], 'amount_cents' => $amount,
                'status' => 'reserved', 'sandbox_scenario' => $account->scenario, 'is_sandbox' => true,
                'idempotency_key' => $key, 'provider_reference' => 'SIM-'.strtoupper(substr($key, 0, 20)),
                'eligible_through' => $cutoff, 'submitted_at' => now(),
            ]);
            foreach ($group['items'] as $item) {
                $payout->items()->create([...$item, 'beneficiary_type' => $group['beneficiary_type'], 'beneficiary_id' => $group['beneficiary_id']]);
            }
            $this->ledger->post('payout-reserve:'.$payout->id, 'payout_reserved', $group['currency'], [
                ['account_code' => $group['beneficiary_type'].'_liability', 'owner_type' => $group['beneficiary_type'], 'owner_id' => $group['beneficiary_id'], 'debit_cents' => $amount],
                ['account_code' => 'payout_payable', 'owner_type' => $group['beneficiary_type'], 'owner_id' => $group['beneficiary_id'], 'credit_cents' => $amount],
            ], now(), null, 'Beneficiary funds reserved for sandbox payout.');
            $payout->update(['status' => 'pending']);

            return $payout->refresh();
        }, 3);
    }

    private function simulate(FinancePayout $payout): void
    {
        match ($payout->sandbox_scenario) {
            'success' => $this->callback($payout->provider_reference, 'success'),
            'duplicate_callback' => tap($this->callback($payout->provider_reference, 'success'), fn () => $this->callback($payout->provider_reference, 'success')),
            'failure' => $this->callback($payout->provider_reference, 'failure'),
            'insufficient_funds' => $this->callback($payout->provider_reference, 'insufficient_funds'),
            default => null,
        };
    }

    private function fullyRemitted(Order $order): bool
    {
        $cleared = (int) DB::table('cod_remittance_allocations')->join('cod_remittance_batches', 'cod_remittance_batches.id', '=', 'cod_remittance_allocations.cod_remittance_batch_id')
            ->where('cod_remittance_allocations.order_id', $order->id)->where('cod_remittance_batches.status', 'cleared')->sum('cod_remittance_allocations.amount_cents');
        [$whole, $fraction] = array_pad(explode('.', (string) $order->payable_total, 2), 2, '');

        return $cleared >= ((int) $whole * 100) + (int) str_pad(substr($fraction, 0, 2), 2, '0');
    }
}
