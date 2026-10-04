<?php

namespace App\Services\Finance\Automation;

use App\Enums\CodInvoiceStatus;
use App\Models\CodInvoice;
use App\Models\CodRemittanceBatch;
use App\Models\LogisticsOrganization;
use App\Models\Order;
use App\Models\User;
use App\Services\Finance\LedgerService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RemittanceService
{
    public function __construct(private readonly LedgerService $ledger) {}

    public function submit(User $actor, string $reference, string $currency, array $allocations): CodRemittanceBatch
    {
        return $this->reserve($actor->logisticsOrganization()->firstOrFail()->id, $reference, $currency, $allocations, false);
    }

    public function reserve(string $organizationId, string $reference, string $currency, array $allocations, bool $gateway): CodRemittanceBatch
    {
        return DB::transaction(function () use ($organizationId, $reference, $currency, $allocations, $gateway) {
            LogisticsOrganization::query()->whereKey($organizationId)->lockForUpdate()->firstOrFail();
            $allocations = collect($allocations)->map(fn ($allocation) => ['order_id' => $allocation['order_id'], 'amount_cents' => (int) $allocation['amount_cents']])->sortBy('order_id')->values()->all();
            $existing = CodRemittanceBatch::query()->where('logistics_organization_id', $organizationId)->where('reference', $reference)->with('allocations')->first();
            if ($existing !== null) {
                $actual = $existing->allocations->sortBy('order_id')->map(fn ($a) => ['order_id' => $a->order_id, 'amount_cents' => $a->amount_cents])->values()->all();
                abort_unless($actual === $allocations && $existing->currency === $currency && (bool) $existing->is_gateway === $gateway, 409, 'This reference already identifies another remittance.');

                return $existing;
            }
            abort_if(count($allocations) < 1, 422, 'Select outstanding invoices.');
            foreach ($allocations as $allocation) {
                $order = Order::query()->whereKey($allocation['order_id'])->where('status', 'delivered')->where('payment_status', 'paid')->where('payment_method', 'cod')->where('currency', $currency)->lockForUpdate()->firstOrFail();
                $invoice = CodInvoice::query()->where('order_id', $order->id)->where('logistics_organization_id', $organizationId)->first();
                if ($invoice === null || $invoice->status !== CodInvoiceStatus::Outstanding) {
                    throw ValidationException::withMessages(['invoice_ids' => 'An invoice is paid, reserved, or outside your organization.']);
                }
                $remaining = $invoice->total_cents - $this->allocated($order->id, ['cleared']);
                if ($this->allocated($order->id, ['submitted']) > 0 || (int) $allocation['amount_cents'] !== $remaining || $remaining < 1) {
                    throw ValidationException::withMessages(['invoice_ids' => 'Pay the full outstanding balance of each unreserved invoice.']);
                }
            }
            $batch = CodRemittanceBatch::create([
                'logistics_organization_id' => $organizationId, 'reference' => $reference, 'currency' => $currency,
                'total_cents' => collect($allocations)->sum('amount_cents'), 'status' => 'submitted',
                'submitted_at' => now(), 'is_gateway' => $gateway,
            ]);
            foreach ($allocations as $allocation) {
                $batch->allocations()->create($allocation);
                CodInvoice::query()->where('order_id', $allocation['order_id'])->update(['status' => CodInvoiceStatus::Processing]);
            }

            return $batch->load('allocations');
        }, 3);
    }

    public function clear(string $batchId, ?User $admin = null, bool $gateway = false): CodRemittanceBatch
    {
        return DB::transaction(function () use ($batchId, $admin, $gateway) {
            $identity = CodRemittanceBatch::findOrFail($batchId);
            LogisticsOrganization::query()->whereKey($identity->logistics_organization_id)->lockForUpdate()->firstOrFail();
            $batch = CodRemittanceBatch::query()->whereKey($batchId)->lockForUpdate()->firstOrFail();
            abort_unless((bool) $batch->is_gateway === $gateway, 409, 'Gateway remittances require a verified payment result.');
            if ($batch->status === 'cleared') {
                return $batch;
            }
            abort_unless($batch->status === 'submitted', 409, 'Only submitted remittances can be cleared.');
            foreach ($batch->allocations()->orderBy('order_id')->get() as $allocation) {
                $order = Order::query()->whereKey($allocation->order_id)->lockForUpdate()->firstOrFail();
                $total = app(CodInvoiceService::class)->cents($order->payable_total);
                abort_if($this->allocated($order->id, ['cleared']) + $allocation->amount_cents > $total, 409, 'Clearing would overfund an Order.');
                $this->ledger->post('remittance:'.$batch->id.':'.$order->id, 'cod_remitted', $batch->currency, [
                    ['account_code' => 'cash', 'owner_type' => 'platform', 'debit_cents' => $allocation->amount_cents],
                    ['account_code' => 'cod_receivable', 'owner_type' => 'platform', 'credit_cents' => $allocation->amount_cents],
                ], now(), $order->id, $gateway ? 'Verified sandbox COD payment.' : 'COD receipt cleared by Admin.');
            }
            $batch->update(['status' => 'cleared', 'cleared_by_admin_id' => $admin?->id, 'cleared_at' => now()]);
            $this->syncBatch($batch);

            return $batch->refresh()->load('allocations');
        }, 3);
    }

    public function release(string $batchId, ?User $admin = null, ?string $reason = null): CodRemittanceBatch
    {
        return DB::transaction(function () use ($batchId, $admin, $reason) {
            $identity = CodRemittanceBatch::findOrFail($batchId);
            LogisticsOrganization::query()->whereKey($identity->logistics_organization_id)->lockForUpdate()->firstOrFail();
            $batch = CodRemittanceBatch::query()->whereKey($batchId)->lockForUpdate()->firstOrFail();
            abort_unless($batch->status === 'submitted', 409, 'Only submitted remittances can be released.');
            abort_if($admin !== null && $batch->is_gateway, 409, 'Processing gateway payments cannot be rejected manually.');
            $batch->update(['status' => $admin ? 'rejected' : 'failed', 'rejected_by' => $admin?->id, 'rejected_at' => now(), 'rejection_reason' => $reason]);
            $this->syncBatch($batch);

            return $batch->refresh();
        }, 3);
    }

    public function allocated(string $orderId, array $statuses): int
    {
        return (int) DB::table('cod_remittance_allocations')->join('cod_remittance_batches', 'cod_remittance_batches.id', '=', 'cod_remittance_allocations.cod_remittance_batch_id')
            ->where('cod_remittance_allocations.order_id', $orderId)->whereIn('cod_remittance_batches.status', $statuses)->sum('cod_remittance_allocations.amount_cents');
    }

    public function syncInvoice(CodInvoice $invoice): void
    {
        $cleared = $this->allocated($invoice->order_id, ['cleared']);
        $status = $cleared >= $invoice->total_cents ? CodInvoiceStatus::Paid
            : ($invoice->logistics_organization_id === null ? CodInvoiceStatus::Review
                : ($this->allocated($invoice->order_id, ['submitted']) > 0 ? CodInvoiceStatus::Processing : CodInvoiceStatus::Outstanding));
        $invoice->update(['status' => $status, 'paid_at' => $status === CodInvoiceStatus::Paid ? ($invoice->paid_at ?? now()) : null]);
    }

    private function syncBatch(CodRemittanceBatch $batch): void
    {
        foreach (CodInvoice::query()->whereIn('order_id', $batch->allocations()->pluck('order_id'))->get() as $invoice) {
            $this->syncInvoice($invoice);
        }
    }
}
