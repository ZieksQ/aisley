<?php

namespace App\Jobs\Finance;

use App\Models\CodInvoice;
use App\Services\Finance\Automation\FinanceDocumentService;
use App\Services\Finance\Automation\FinanceNoticeService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class IssueCodInvoiceDocument implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $invoiceId) {}

    public function handle(FinanceDocumentService $documents, FinanceNoticeService $notices): void
    {
        $documents->invoice(CodInvoice::findOrFail($this->invoiceId));
        $notices->dispatchPending();
    }
}
