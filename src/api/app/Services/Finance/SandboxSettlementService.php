<?php

namespace App\Services\Finance;

use App\Models\FinancePaymentAttempt;
use App\Models\FinancePayout;
use App\Services\Finance\Automation\PayoutService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SandboxSettlementService
{
    public function __construct(private readonly LedgerService $ledger) {}

    public function run(): int
    {
        $service = app(PayoutService::class);
        $created = 0;
        foreach (['seller', 'logistics'] as $type) {
            $groups = collect($service->obligations($type))->filter(fn ($item) => $item['blocked'] === [])
                ->groupBy(fn ($item) => $item['beneficiary_id'].':'.$item['currency']);
            foreach ($groups as $items) {
                $created += $service->pay($type, $items->first()['beneficiary_id'], $items->pluck('order_id')->all(), (string) Str::uuid()) !== null ? 1 : 0;
            }
        }

        return $created;
    }

    public function callback(string $providerReference, string $outcome): FinancePayout
    {
        return DB::transaction(function () use ($providerReference, $outcome): FinancePayout {
            $payout = FinancePayout::query()->where('provider_reference', $providerReference)->lockForUpdate()->firstOrFail();
            abort_if(FinancePaymentAttempt::query()->where('finance_payout_id', $payout->id)->exists(), 409, 'Gateway payouts require a verified gateway result.');
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
                $payout->items()->update(['released_at' => now()]);
            }

            return $payout->refresh();
        }, 3);
    }
}
