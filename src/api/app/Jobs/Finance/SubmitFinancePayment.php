<?php

namespace App\Jobs\Finance;

use App\Enums\FinancePaymentStatus;
use App\Models\FinancePaymentAttempt;
use App\Services\Finance\Automation\PaymentResultService;
use App\Services\Finance\Gateway\GatewayClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Throwable;

class SubmitFinancePayment implements ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    public function __construct(public string $attemptId) {}

    public function backoff(): array
    {
        return [15, 60, 300, 900];
    }

    public function handle(GatewayClient $gateway, PaymentResultService $results): void
    {
        $attempt = FinancePaymentAttempt::findOrFail($this->attemptId);
        if ($attempt->resolved_at !== null || ! config('finance.gateway_enabled')) {
            return;
        }
        try {
            $object = $gateway->send($attempt);
            $results->apply($attempt->id, $object);
        } catch (Throwable $error) {
            DB::transaction(function () {
                $attempt = FinancePaymentAttempt::query()->whereKey($this->attemptId)->lockForUpdate()->firstOrFail();
                if ($attempt->resolved_at === null) {
                    $attempt->update(['status' => FinancePaymentStatus::Unknown]);
                }
            });
            throw $error;
        }
    }
}
