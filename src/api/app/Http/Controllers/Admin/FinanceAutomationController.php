<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Finance\CollectorReviewRequest;
use App\Http\Requests\Finance\PayoutSelectionRequest;
use App\Http\Requests\Finance\RemittanceRejectionRequest;
use App\Jobs\Finance\IssueCodInvoiceDocument;
use App\Models\CodInvoice;
use App\Models\LogisticsOrganization;
use App\Models\Order;
use App\Services\Finance\Automation\FinanceReadService;
use App\Services\Finance\Automation\PayoutService;
use App\Services\Finance\Automation\RemittanceService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class FinanceAutomationController extends Controller
{
    public function payout(PayoutSelectionRequest $request, PayoutService $payouts, FinanceReadService $reads)
    {
        $data = $request->validated();
        $attempt = $payouts->pay($data['beneficiary_type'], $data['beneficiary_id'], $data['order_ids'], $data['idempotency_key'], $data['early'] ?? false, $request->user()->id);
        abort_unless($attempt, 409, 'The selected obligations are already reserved.');

        return response()->json(['data' => $reads->attempt($attempt)], 202);
    }

    public function reject(RemittanceRejectionRequest $request, string $batch, RemittanceService $remittances)
    {
        return response()->json(['data' => $remittances->release($batch, $request->user(), $request->validated('reason'))]);
    }

    public function collector(CollectorReviewRequest $request, string $invoice, RemittanceService $remittances)
    {
        $result = DB::transaction(function () use ($request, $invoice, $remittances) {
            $identity = CodInvoice::findOrFail($invoice);
            Order::query()->whereKey($identity->order_id)->lockForUpdate()->firstOrFail();
            $record = CodInvoice::query()->whereKey($invoice)->lockForUpdate()->firstOrFail();
            abort_unless($record->logistics_organization_id === null, 409, 'Collector ownership is already recorded.');
            $organization = LogisticsOrganization::findOrFail($request->validated('logistics_organization_id'));
            $record->update(['logistics_organization_id' => $organization->id, 'collector_name' => $organization->business_name,
                'review_reason' => 'Reviewed by '.$request->user()->id.': '.$request->validated('reason')]);
            $remittances->syncInvoice($record);
            Storage::disk('local')->delete('finance/invoices/'.$record->id.'.pdf');

            return $record->refresh();
        });
        IssueCodInvoiceDocument::dispatch($result->id);

        return response()->json(['data' => $result]);
    }
}
