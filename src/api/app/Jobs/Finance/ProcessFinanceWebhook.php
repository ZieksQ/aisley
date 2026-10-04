<?php

namespace App\Jobs\Finance;

use App\Models\FinanceWebhookReceipt;
use App\Services\Finance\Automation\PaymentResultService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

class ProcessFinanceWebhook implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $receiptId) {}

    public function handle(PaymentResultService $results): void
    {
        DB::transaction(function () use ($results) {
            $receipt = FinanceWebhookReceipt::query()->whereKey($this->receiptId)->lockForUpdate()->firstOrFail();
            if ($receipt->processed_at !== null) {
                return;
            }
            $object = $receipt->payload['data'];
            $results->apply($object['metadata']['attempt_id'], $object);
            $receipt->update(['processed_at' => now()]);
        }, 3);
    }
}
