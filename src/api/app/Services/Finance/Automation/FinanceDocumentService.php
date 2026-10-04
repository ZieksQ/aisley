<?php

namespace App\Services\Finance\Automation;

use App\Models\CodInvoice;
use App\Models\CodRemittanceBatch;
use App\Models\FinancePayout;
use App\Models\LogisticsOrganization;
use App\Models\Order;
use App\Models\Shop;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;

class FinanceDocumentService
{
    public function invoice(CodInvoice $invoice): string
    {
        $path = 'finance/invoices/'.$invoice->id.'.pdf';
        $disk = Storage::disk('local');
        if (! $disk->exists($path)) {
            $disk->put($path, $this->render('COD remittance invoice', $invoice->reference, $invoice->currency, $invoice->total_cents, [
                ['Order', $invoice->order_reference], ['Collecting organization', $invoice->collector_name ?? 'Requires review'],
                ['Confirmed delivery', $invoice->delivered_at->timezone('Asia/Manila')->format('Y-m-d H:i')],
                ['Payment due', $invoice->due_at->timezone('Asia/Manila')->format('Y-m-d H:i')],
            ]));
        }

        return $disk->get($path);
    }

    public function remittance(CodRemittanceBatch $batch): string
    {
        abort_unless($batch->status === 'cleared', 409, 'A payment receipt is available after clearing.');
        $rows = $batch->allocations()->with('order:id,reference')->get()->map(fn ($a) => [$a->order->reference, number_format($a->amount_cents / 100, 2)]);
        $rows->prepend(['Paid by', LogisticsOrganization::find($batch->logistics_organization_id)?->business_name ?? 'Historical Logistics']);
        $rows->prepend(['Received by', 'Aisley (sandbox)']);
        $rows->prepend(['Payment confirmed', $batch->cleared_at->timezone('Asia/Manila')->format('Y-m-d H:i')]);

        return $this->render('COD payment receipt', $batch->reference, $batch->currency, $batch->total_cents, $rows->all());
    }

    public function payout(FinancePayout $payout): string
    {
        abort_unless($payout->status === 'succeeded', 409, 'A payout receipt is available after success.');
        $rows = $payout->items()->get()->map(fn ($item) => [Order::findOrFail($item->order_id)->reference, number_format($item->amount_cents / 100, 2)]);
        $rows->prepend(['Paid by', 'Aisley (sandbox)']);
        $rows->prepend(['Beneficiary', $payout->beneficiary_type === 'seller' ? Shop::find($payout->beneficiary_id)?->name : LogisticsOrganization::find($payout->beneficiary_id)?->business_name]);
        $rows->prepend(['Gateway reference', $payout->provider_reference ?? 'Legacy sandbox']);
        $rows->prepend(['Payment confirmed', $payout->resolved_at->timezone('Asia/Manila')->format('Y-m-d H:i')]);

        return $this->render('Beneficiary payout receipt', $payout->id, $payout->currency, $payout->amount_cents, $rows->all());
    }

    private function render(string $title, string $reference, string $currency, int $amount, array $rows): string
    {
        return Pdf::setOptions(['isRemoteEnabled' => false, 'isPhpEnabled' => false, 'isJavascriptEnabled' => false, 'defaultFont' => 'Helvetica'])
            ->loadView('finance.document', compact('title', 'reference', 'currency', 'amount', 'rows'))->setPaper('a4')->output();
    }
}
