<?php

namespace App\Services\Finance;

use App\Models\CourierCashCredit;
use App\Models\SandboxGatewayAccount;
use Illuminate\Support\Facades\DB;

class CourierCashCreditService
{
    public function apply(string $id): void
    {
        if (! config('finance.gateway_enabled')) {
            return;
        }
        DB::transaction(function () use ($id): void {
            $credit = CourierCashCredit::query()->whereKey($id)->lockForUpdate()->firstOrFail();
            if ($credit->credited_at !== null) {
                return;
            }
            $account = SandboxGatewayAccount::query()->whereKey($credit->sandbox_gateway_account_id)->lockForUpdate()->firstOrFail();
            if (! $account->is_active || $account->currency !== $credit->currency) {
                return; // Keep the immutable receipt and retry its credit once the account is available.
            }
            $account->increment('balance_cents', $credit->amount_cents);
            $credit->update(['credited_at' => now()]);
        }, 3);
    }

    public function recover(): void
    {
        if (config('finance.gateway_enabled')) {
            CourierCashCredit::query()->whereNull('credited_at')->orderBy('id')->each(fn ($credit) => $this->apply($credit->id));
        }
    }
}
