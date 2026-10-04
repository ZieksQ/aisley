<?php

namespace App\Services\Finance\Automation;

use App\Enums\FinancePaymentStatus;
use App\Models\FinancePaymentAttempt;
use App\Models\FinancePayout;
use Illuminate\Support\Facades\DB;

class PaymentResultService
{
    public function __construct(private readonly RemittanceService $remittances, private readonly PayoutService $payouts) {}

    public function apply(string $attemptId, array $object): void
    {
        DB::transaction(function () use ($attemptId, $object) {
            $attempt = FinancePaymentAttempt::query()->whereKey($attemptId)->lockForUpdate()->firstOrFail();
            abort_unless(($object['metadata']['attempt_id'] ?? null) === $attempt->id
                && ($object['livemode'] ?? true) === false && ($object['amount_cents'] ?? null) === $attempt->amount_cents
                && ($object['currency'] ?? null) === $attempt->currency && ($object['account_reference'] ?? null) === $attempt->account_reference
                && ($object['direction'] ?? null) === $attempt->direction->value
                && (! $attempt->provider_reference || $attempt->provider_reference === ($object['id'] ?? null)), 409, 'Gateway result does not match the payment reservation.');
            abort_unless(is_string($object['id'] ?? null), 422, 'Gateway transaction reference is missing.');
            if ($attempt->resolved_at !== null) {
                return;
            }
            $status = FinancePaymentStatus::tryFrom($object['status'] ?? '');
            abort_unless(in_array($status, [FinancePaymentStatus::Pending, FinancePaymentStatus::Succeeded, FinancePaymentStatus::Failed], true), 422, 'Unsupported gateway payment status.');
            $terminal = $status !== FinancePaymentStatus::Pending;
            if ($terminal) {
                $success = $status === FinancePaymentStatus::Succeeded;
                if ($attempt->direction->value === 'collection') {
                    $success ? $this->remittances->clear($attempt->cod_remittance_batch_id, null, true)
                        : $this->remittances->release($attempt->cod_remittance_batch_id, null, $object['failure_code'] ?? 'payment_failed');
                } else {
                    $this->payouts->resolve(FinancePayout::findOrFail($attempt->finance_payout_id), $success);
                }
            }
            $attempt->update(['provider_reference' => $object['id'], 'status' => $status,
                'failure_code' => $object['failure_code'] ?? null, 'resolved_at' => $terminal ? now() : null]);
            if ($attempt->finance_payout_id) {
                FinancePayout::query()->whereKey($attempt->finance_payout_id)->update(['provider_reference' => $object['id']]);
            }
        }, 3);
    }
}
