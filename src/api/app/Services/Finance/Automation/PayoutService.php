<?php

namespace App\Services\Finance\Automation;

use App\Enums\FinancePaymentDirection;
use App\Enums\FinancePaymentStatus;
use App\Enums\OrderStatus;
use App\Jobs\Finance\SubmitFinancePayment;
use App\Models\CodInvoice;
use App\Models\FinanceLedgerLine;
use App\Models\FinancePaymentAttempt;
use App\Models\FinancePayout;
use App\Models\FinancePayoutItem;
use App\Models\FinanceSandboxBeneficiaryAccount;
use App\Models\LogisticsOrganization;
use App\Models\Order;
use App\Models\SandboxGatewayAccount;
use App\Services\Finance\LedgerService;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

class PayoutService
{
    public function __construct(private readonly LedgerService $ledger, private readonly FinanceSettingsService $settings, private readonly RemittanceService $remittances) {}

    public function obligations(string $type, ?string $beneficiaryId = null, bool $early = false): array
    {
        $rows = [];
        $settings = $this->settings->platform();
        $orders = Order::query()->where('status', 'delivered')->whereHas('pricingSnapshot')->with(['pricingSnapshot', 'statusEvents', 'shop'])->get();
        foreach ($orders as $order) {
            $invoice = CodInvoice::query()->where('order_id', $order->id)->first();
            $deliveredAt = $invoice?->delivered_at ?? $order->statusEvents->where('to_status', OrderStatus::Delivered)->max('occurred_at');
            if (! $deliveredAt) {
                continue;
            }
            $eligible = $type === 'seller' ? $invoice?->seller_eligible_at : $invoice?->logistics_eligible_at;
            $eligible ??= CarbonImmutable::parse($deliveredAt)->addHours($type === 'seller' ? $settings->seller_delay_hours : $settings->logistics_delay_hours);
            $allocations = $type === 'seller' ? [['id' => $order->shop_id, 'amount' => $order->pricingSnapshot->seller_proceeds_cents]]
                : DB::table('logistics_service_allocations')->where('order_id', $order->id)->whereIn('status', ['committed', 'reconciled'])->selectRaw('logistics_organization_id as id, SUM(amount_cents) as amount')->groupBy('logistics_organization_id')->get()->map(fn ($a) => (array) $a)->all();
            foreach ($allocations as $allocation) {
                if (($beneficiaryId && $beneficiaryId !== $allocation['id']) || (int) $allocation['amount'] < 1
                    || FinancePayoutItem::query()->where('order_id', $order->id)->where('beneficiary_type', $type)->where('beneficiary_id', $allocation['id'])->whereNull('released_at')->exists()) {
                    continue;
                }
                $blocked = [];
                if ($this->remittances->allocated($order->id, ['cleared']) < app(CodInvoiceService::class)->cents($order->payable_total)) {
                    $blocked[] = 'COD not fully remitted';
                }
                if (DB::table('financial_holds')->where('order_id', $order->id)->whereNull('released_at')->exists()) {
                    $blocked[] = 'Financial hold';
                }
                if ($order->statusEvents->contains(fn ($event) => $event->to_status === OrderStatus::Cancelled)) {
                    $blocked[] = 'Order was cancelled';
                }
                if ($eligible->isFuture() && ! ($early && $type === 'logistics')) {
                    $blocked[] = 'Waiting period';
                }
                $name = $type === 'seller' ? $order->shop->name : LogisticsOrganization::find($allocation['id'])?->business_name;
                $rows[] = ['order_id' => $order->id, 'order_reference' => $order->reference, 'beneficiary_type' => $type,
                    'beneficiary_id' => $allocation['id'], 'beneficiary_name' => $name, 'currency' => $order->currency,
                    'amount_cents' => (int) $allocation['amount'], 'eligible_at' => $eligible->toISOString(), 'blocked' => $blocked];
            }
        }

        return $rows;
    }

    public function pay(string $type, string $beneficiaryId, array $orderIds, string $key, bool $early = false, ?string $actorId = null): ?FinancePaymentAttempt
    {
        abort_unless(config('finance.gateway_enabled'), 503, 'Sandbox gateway is disabled.');
        sort($orderIds);
        $identity = 'payout:'.$type.':'.$beneficiaryId.':'.$key;
        $hash = hash('sha256', json_encode([$type, $beneficiaryId, $orderIds, $early], JSON_THROW_ON_ERROR));

        return DB::transaction(function () use ($type, $beneficiaryId, $orderIds, $identity, $hash, $early, $actorId) {
            $account = FinanceSandboxBeneficiaryAccount::query()->firstOrCreate(['beneficiary_type' => $type, 'beneficiary_id' => $beneficiaryId], ['account_reference' => $type.'-'.$beneficiaryId, 'scenario' => 'success', 'is_active' => true]);
            $account = FinanceSandboxBeneficiaryAccount::query()->whereKey($account->id)->lockForUpdate()->firstOrFail();
            $existing = FinancePaymentAttempt::query()->where('idempotency_key', $identity)->first();
            if ($existing) {
                abort_unless(hash_equals($existing->request_hash, $hash), 409, 'Payout key payload mismatch.');

                return $existing;
            }
            abort_unless($account->is_active, 422, 'Beneficiary account is inactive.');
            // Lock Orders before re-evaluating holds, funding, reversals, and obligations.
            Order::query()->whereIn('id', $orderIds)->orderBy('id')->lockForUpdate()->get();
            $items = collect($this->obligations($type, $beneficiaryId, $early))->whereIn('order_id', $orderIds)->values();
            if ($items->isEmpty()) {
                return null;
            }
            abort_unless($items->count() === count($orderIds) && $items->every(fn ($item) => $item['blocked'] === []), 409, 'Selected obligations are blocked or already reserved.');
            abort_unless($items->pluck('currency')->unique()->count() === 1, 422, 'Use one currency per payout.');
            $currency = $items->first()['currency'];
            $amount = $items->sum('amount_cents');
            $available = FinanceLedgerLine::query()->where('owner_type', $type)->where('owner_id', $beneficiaryId)->where('account_code', $type.'_liability')->whereHas('journal', fn ($q) => $q->where('currency', $currency))->get()->sum(fn ($line) => $line->credit_cents - $line->debit_cents);
            abort_unless($available >= $amount, 409, 'Recorded liability is below the selected payout amount.');
            SandboxGatewayAccount::query()->firstOrCreate(['reference' => $account->account_reference], ['scenario' => $account->scenario, 'balance_cents' => $type === 'logistics' ? 0 : 100000000]);
            $payout = FinancePayout::create([
                'beneficiary_type' => $type, 'beneficiary_id' => $beneficiaryId, 'sandbox_beneficiary_account_id' => $account->id,
                'amount_cents' => $amount, 'currency' => $currency, 'status' => 'pending', 'is_sandbox' => true,
                'sandbox_scenario' => $account->scenario, 'idempotency_key' => $identity,
                'eligible_through' => now(), 'submitted_at' => now(),
            ]);
            foreach ($items as $item) {
                $payout->items()->create(['order_id' => $item['order_id'], 'beneficiary_type' => $type, 'beneficiary_id' => $beneficiaryId, 'amount_cents' => $item['amount_cents']]);
            }
            $this->ledger->post('payout-reserve:'.$payout->id, 'payout_reserved', $currency, [
                ['account_code' => $type.'_liability', 'owner_type' => $type, 'owner_id' => $beneficiaryId, 'debit_cents' => $amount],
                ['account_code' => 'payout_payable', 'owner_type' => $type, 'owner_id' => $beneficiaryId, 'credit_cents' => $amount],
            ], now(), null, $early ? 'Manual early Logistics payout reserved.' : 'Beneficiary payout reserved.');
            $attempt = FinancePaymentAttempt::create([
                'status' => FinancePaymentStatus::Reserved, 'direction' => FinancePaymentDirection::Payout, 'idempotency_key' => $identity, 'request_hash' => $hash,
                'account_reference' => $account->account_reference, 'currency' => $currency, 'amount_cents' => $amount,
                'finance_payout_id' => $payout->id, 'initiated_by' => $actorId,
            ]);
            SubmitFinancePayment::dispatch($attempt->id)->afterCommit();

            return $attempt;
        }, 3);
    }

    public function resolve(FinancePayout $payout, bool $success): void
    {
        $payout = FinancePayout::query()->whereKey($payout->id)->lockForUpdate()->firstOrFail();
        if (in_array($payout->status, ['succeeded', 'failed'], true)) {
            return;
        }
        $this->ledger->post(($success ? 'payout-resolve:' : 'payout-reverse:').$payout->id, $success ? 'sandbox_payout_succeeded' : 'sandbox_payout_failed', $payout->currency, [
            ['account_code' => 'payout_payable', 'owner_type' => $payout->beneficiary_type, 'owner_id' => $payout->beneficiary_id, 'debit_cents' => $payout->amount_cents],
            $success ? ['account_code' => 'cash', 'owner_type' => 'platform', 'credit_cents' => $payout->amount_cents]
                : ['account_code' => $payout->beneficiary_type.'_liability', 'owner_type' => $payout->beneficiary_type, 'owner_id' => $payout->beneficiary_id, 'credit_cents' => $payout->amount_cents],
        ], now(), null, $success ? 'Sandbox payout verified.' : 'Failed sandbox payout reservation reversed.');
        $payout->update(['status' => $success ? 'succeeded' : 'failed', 'resolved_at' => now()]);
        if (! $success) {
            $payout->items()->update(['released_at' => now()]);
        }
    }
}
