<?php

namespace App\Http\Controllers\Finance;

use App\Http\Controllers\Controller;
use App\Http\Requests\Finance\AutomationSettingsRequest;
use App\Http\Requests\Finance\PaymentSelectionRequest;
use App\Http\Resources\Finance\CodInvoiceResource;
use App\Models\CodRemittanceAllocation;
use App\Models\FinanceAutomationRun;
use App\Services\Finance\Automation\CollectionService;
use App\Services\Finance\Automation\FinanceDocumentService;
use App\Services\Finance\Automation\FinanceReadService;
use App\Services\Finance\Automation\FinanceSettingsService;
use App\Services\Finance\Automation\PayoutService;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;

abstract class AbstractPaymentsController extends Controller
{
    abstract protected function role(): string;

    public function invoices(Request $request, FinanceReadService $reads)
    {
        $filters = $request->validate(['status' => ['nullable', 'in:outstanding,processing,paid,review,overdue'], 'search' => ['nullable', 'string', 'max:120']]);
        $query = $reads->invoices($request->user(), $this->role());
        if (($filters['status'] ?? '') === 'overdue') {
            $query->whereNull('paid_at')->where('due_at', '<', now());
        } elseif ($filters['status'] ?? null) {
            $query->where('status', $filters['status']);
        }
        if ($filters['search'] ?? null) {
            $search = $filters['search'];
            $query->where(fn ($q) => $q->where('reference', 'like', '%'.$search.'%')->orWhere('order_reference', 'like', '%'.$search.'%')->orWhere('collector_name', 'like', '%'.$search.'%'));
        }

        return CodInvoiceResource::collection($query->orderBy('due_at')->orderBy('id')->paginate(25))->additional(['summary' => $reads->invoiceSummary($request->user(), $this->role())])->response()->header('Cache-Control', 'private, no-store');
    }

    public function invoice(Request $request, string $invoice, FinanceReadService $reads)
    {
        $record = $reads->invoices($request->user(), $this->role())->whereKey($invoice)->firstOrFail();
        $batchIds = CodRemittanceAllocation::query()->where('order_id', $record->order_id)->pluck('cod_remittance_batch_id');
        $batches = $reads->batches($request->user(), $this->role())->whereIn('id', $batchIds)->latest()->get()->map(fn ($b) => $reads->batch($b));

        return $this->json(['data' => (new CodInvoiceResource($record))->resolve($request), 'batches' => $batches]);
    }

    public function invoicePdf(Request $request, string $invoice, FinanceReadService $reads, FinanceDocumentService $documents)
    {
        $record = $reads->invoices($request->user(), $this->role())->whereKey($invoice)->firstOrFail();

        return $this->pdf($documents->invoice($record), $record->reference.'.pdf');
    }

    public function batches(Request $request, FinanceReadService $reads)
    {
        $page = $reads->batches($request->user(), $this->role())->latest('submitted_at')->orderBy('id')->paginate(25);
        $page->setCollection($page->getCollection()->map(fn ($batch) => $reads->batch($batch)));

        return $this->json($page->toArray());
    }

    public function batch(Request $request, string $batch, FinanceReadService $reads)
    {
        return $this->json(['data' => $reads->batch($reads->batches($request->user(), $this->role())->whereKey($batch)->firstOrFail())]);
    }

    public function receipt(Request $request, string $batch, FinanceReadService $reads, FinanceDocumentService $documents)
    {
        return $this->pdf($documents->remittance($reads->batches($request->user(), $this->role())->whereKey($batch)->firstOrFail()), 'cod-payment-'.$batch.'.pdf');
    }

    public function pay(PaymentSelectionRequest $request, CollectionService $collections, FinanceReadService $reads)
    {
        $data = $request->validated();
        $attempt = $collections->pay($reads->scope($request->user(), 'logistics'), $data['invoice_ids'], $data['idempotency_key'], $request->user()->id);

        return $this->json(['data' => $reads->attempt($attempt)], 202);
    }

    public function settings(Request $request, FinanceSettingsService $settings, FinanceReadService $reads)
    {
        $collection = $this->role() === 'logistics' ? $settings->collection($reads->scope($request->user(), 'logistics')) : null;
        $platform = $settings->platform();
        $next = now('Asia/Manila')->setTimeFromTimeString($collection?->collection_time ?? $platform->collection_time);
        $completedToday = $this->role() === 'logistics' && FinanceAutomationRun::query()
            ->where('run_key', 'collection:'.$reads->scope($request->user(), 'logistics').':'.now('Asia/Manila')->toDateString())->whereNotNull('completed_at')->exists();
        if ($next->lte(now('Asia/Manila')) || $completedToday) {
            $next->addDay();
        }

        return $this->json(['data' => ['platform' => $platform, 'collection' => $collection, 'timezone' => 'Asia/Manila',
            'next_collection_at' => $platform->collection_enabled && config('finance.gateway_enabled') ? $next->toISOString() : null, 'gateway_enabled' => config('finance.gateway_enabled'),
            'can_manage' => $this->role() === 'logistics' || ($this->role() === 'admin' && $request->user()->permissions()->where('slug', 'finance.manage')->exists())]]);
    }

    public function updateSettings(AutomationSettingsRequest $request, FinanceSettingsService $settings, FinanceReadService $reads)
    {
        $scope = $this->role() === 'logistics' ? 'logistics:'.$reads->scope($request->user(), 'logistics') : 'platform';

        return $this->json(['data' => $settings->update($request->user(), $scope, $request->validated())]);
    }

    public function payouts(Request $request, FinanceReadService $reads)
    {
        $page = $reads->payouts($request->user(), $this->role())->latest('submitted_at')->orderBy('id')->paginate(25);
        $page->setCollection($page->getCollection()->map(fn ($p) => $reads->payout($p)));

        return $this->json($page->toArray());
    }

    public function obligations(Request $request, PayoutService $payouts, FinanceReadService $reads)
    {
        $type = $this->role();
        if ($type === 'admin') {
            $request->validate(['beneficiary_type' => ['required', 'in:seller,logistics'], 'early' => ['sometimes', 'boolean']]);
            $type = $request->input('beneficiary_type');
        }
        $rows = $payouts->obligations($type, $this->role() === 'admin' ? null : $reads->scope($request->user(), $this->role()), $this->role() === 'admin' && $request->boolean('early'));
        $page = new LengthAwarePaginator(array_slice($rows, (max(1, $request->integer('page', 1)) - 1) * 25, 25), count($rows), 25, max(1, $request->integer('page', 1)));

        return $this->json($page->toArray());
    }

    public function payoutReceipt(Request $request, string $payout, FinanceReadService $reads, FinanceDocumentService $documents)
    {
        return $this->pdf($documents->payout($reads->payouts($request->user(), $this->role())->whereKey($payout)->firstOrFail()), 'payout-'.$payout.'.pdf');
    }

    protected function json(array $payload, int $status = 200)
    {
        return response()->json($payload, $status)->header('Cache-Control', 'private, no-store');
    }

    private function pdf(string $bytes, string $filename)
    {
        return response($bytes)->withHeaders(['Content-Type' => 'application/pdf', 'Content-Disposition' => 'attachment; filename="'.$filename.'"', 'Cache-Control' => 'private, no-store']);
    }
}
