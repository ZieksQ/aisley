<?php

namespace App\Services\Finance\Automation;

use App\Models\CodInvoice;
use App\Models\CodRemittanceBatch;
use App\Models\FinancePaymentAttempt;
use App\Models\FinancePayout;
use App\Models\LogisticsOrganization;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class FinanceReadService
{
    public function scope(User $user, string $role): ?string
    {
        return match ($role) {
            'logistics' => $user->logisticsOrganization()->firstOrFail()->id,
            'seller' => $user->shop()->firstOrFail()->id,
            default => null,
        };
    }

    public function invoices(User $user, string $role): Builder
    {
        $query = CodInvoice::query();
        if ($role !== 'admin') {
            $query->where('logistics_organization_id', $this->scope($user, $role));
        }

        return $query;
    }

    public function invoiceSummary(User $user, string $role): array
    {
        $cleared = DB::table('cod_remittance_allocations')
            ->join('cod_remittance_batches', 'cod_remittance_batches.id', '=', 'cod_remittance_allocations.cod_remittance_batch_id')
            ->where('cod_remittance_batches.status', 'cleared')->groupBy('order_id')->selectRaw('order_id, SUM(amount_cents) AS cleared_cents');
        $query = $this->invoices($user, $role)->whereNull('cod_invoices.paid_at')->toBase()
            ->leftJoinSub($cleared, 'cleared', 'cleared.order_id', '=', 'cod_invoices.order_id');
        $balance = 'CASE WHEN cod_invoices.total_cents > COALESCE(cleared.cleared_cents, 0) THEN cod_invoices.total_cents - COALESCE(cleared.cleared_cents, 0) ELSE 0 END';
        $all = (clone $query)->selectRaw('COALESCE(SUM('.$balance.'), 0) AS amount')->first();
        $overdue = (clone $query)->where('cod_invoices.due_at', '<', now())->selectRaw('COALESCE(SUM('.$balance.'), 0) AS amount')->first();

        return ['currency' => 'PHP', 'outstanding_cents' => (int) $all->amount, 'overdue_cents' => (int) $overdue->amount];
    }

    public function batches(User $user, string $role): Builder
    {
        return CodRemittanceBatch::query()->when($role !== 'admin', fn ($q) => $q->where('logistics_organization_id', $this->scope($user, $role)));
    }

    public function payouts(User $user, string $role): Builder
    {
        return FinancePayout::query()->when($role !== 'admin', fn ($q) => $q->where('beneficiary_type', $role)->where('beneficiary_id', $this->scope($user, $role)));
    }

    public function batch(CodRemittanceBatch $batch): array
    {
        return ['collector_name' => LogisticsOrganization::find($batch->logistics_organization_id)?->business_name, 'id' => $batch->id, 'reference' => $batch->reference, 'logistics_organization_id' => $batch->logistics_organization_id,
            'status' => $batch->status, 'currency' => $batch->currency, 'total_cents' => $batch->total_cents,
            'is_gateway' => $batch->is_gateway, 'submitted_at' => $batch->submitted_at?->toISOString(), 'cleared_at' => $batch->cleared_at?->toISOString(),
            'rejection_reason' => $batch->rejection_reason,
            'allocations' => $batch->allocations()->with('order:id,reference')->get()->map(fn ($a) => ['order_id' => $a->order_id, 'order_reference' => $a->order->reference, 'amount_cents' => $a->amount_cents]),
            'attempts' => FinancePaymentAttempt::query()->where('cod_remittance_batch_id', $batch->id)->get()->map(fn ($a) => $this->attempt($a))];
    }

    public function attempt(FinancePaymentAttempt $attempt): array
    {
        return ['id' => $attempt->id, 'direction' => $attempt->direction->value, 'status' => $attempt->status->value,
            'provider_reference' => $attempt->provider_reference, 'amount_cents' => $attempt->amount_cents, 'currency' => $attempt->currency,
            'cod_remittance_batch_id' => $attempt->cod_remittance_batch_id, 'finance_payout_id' => $attempt->finance_payout_id,
            'failure_code' => $attempt->failure_code, 'created_at' => $attempt->created_at->toISOString(), 'resolved_at' => $attempt->resolved_at?->toISOString()];
    }

    public function payout(FinancePayout $payout): array
    {
        return ['beneficiary_name' => $payout->beneficiary_type === 'seller' ? Shop::find($payout->beneficiary_id)?->name : LogisticsOrganization::find($payout->beneficiary_id)?->business_name, 'id' => $payout->id, 'beneficiary_type' => $payout->beneficiary_type, 'beneficiary_id' => $payout->beneficiary_id,
            'currency' => $payout->currency, 'amount_cents' => $payout->amount_cents, 'status' => $payout->status,
            'provider_reference' => $payout->provider_reference, 'is_sandbox' => $payout->is_sandbox,
            'submitted_at' => $payout->submitted_at?->toISOString(), 'resolved_at' => $payout->resolved_at?->toISOString(),
            'attempts' => FinancePaymentAttempt::query()->where('finance_payout_id', $payout->id)->get()->map(fn ($a) => $this->attempt($a))];
    }
}
