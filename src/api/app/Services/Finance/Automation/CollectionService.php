<?php

namespace App\Services\Finance\Automation;

use App\Enums\FinancePaymentDirection;
use App\Enums\FinancePaymentStatus;
use App\Jobs\Finance\SubmitFinancePayment;
use App\Models\CodInvoice;
use App\Models\FinancePaymentAttempt;
use App\Models\LogisticsOrganization;
use App\Services\Finance\Gateway\LogisticsBillingService;
use Illuminate\Support\Facades\DB;

class CollectionService
{
    public function __construct(private readonly RemittanceService $remittances) {}

    public function pay(string $organizationId, array $invoiceIds, string $key, ?string $actorId = null): FinancePaymentAttempt
    {
        abort_unless(config('finance.gateway_enabled'), 503, 'Sandbox gateway is disabled.');
        sort($invoiceIds);
        $hash = hash('sha256', json_encode([$organizationId, $invoiceIds], JSON_THROW_ON_ERROR));
        $identity = 'collection:'.$organizationId.':'.$key;

        return DB::transaction(function () use ($organizationId, $invoiceIds, $identity, $hash, $actorId) {
            LogisticsOrganization::query()->whereKey($organizationId)->lockForUpdate()->firstOrFail();
            $existing = FinancePaymentAttempt::query()->where('idempotency_key', $identity)->first();
            if ($existing) {
                abort_unless(hash_equals($existing->request_hash, $hash), 409, 'Payment key payload mismatch.');

                return $existing;
            }
            $invoices = CodInvoice::query()->whereIn('id', $invoiceIds)->where('logistics_organization_id', $organizationId)->get();
            abort_unless($invoices->count() === count($invoiceIds) && $invoices->count() > 0, 404);
            abort_unless($invoices->pluck('currency')->unique()->count() === 1, 422, 'Use one currency per payment.');
            $accountReference = 'logistics-'.$organizationId;
            app(LogisticsBillingService::class)->provision(LogisticsOrganization::findOrFail($organizationId));
            $batch = $this->remittances->reserve($organizationId, $identity, $invoices->first()->currency,
                $invoices->map(fn ($invoice) => ['order_id' => $invoice->order_id, 'amount_cents' => $invoice->total_cents - $this->remittances->allocated($invoice->order_id, ['cleared'])])->all(), true);
            $attempt = FinancePaymentAttempt::create([
                'status' => FinancePaymentStatus::Reserved, 'direction' => FinancePaymentDirection::Collection, 'idempotency_key' => $identity, 'request_hash' => $hash,
                'account_reference' => $accountReference, 'amount_cents' => $batch->total_cents, 'currency' => $batch->currency,
                'cod_remittance_batch_id' => $batch->id, 'initiated_by' => $actorId,
            ]);
            SubmitFinancePayment::dispatch($attempt->id)->afterCommit();

            return $attempt;
        }, 3);
    }
}
