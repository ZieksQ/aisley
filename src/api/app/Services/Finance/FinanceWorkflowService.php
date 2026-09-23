<?php

namespace App\Services\Finance;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Models\CodRemittanceBatch;
use App\Models\FinanceExpense;
use App\Models\FinancePeriodClosure;
use App\Models\FinancialHold;
use App\Models\LinehaulTrip;
use App\Models\Order;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FinanceWorkflowService
{
    public function __construct(
        private readonly LedgerService $ledger,
        private readonly LogisticsAllocationService $logisticsAllocation,
    ) {}

    /** @param list<array{order_id: string, amount_cents: int}> $allocations */
    public function submitRemittance(User $logistics, string $reference, string $currency, array $allocations): CodRemittanceBatch
    {
        $organization = $logistics->logisticsOrganization()->firstOrFail();
        $total = collect($allocations)->sum('amount_cents');
        if ($total < 1) {
            throw ValidationException::withMessages(['allocations' => 'Allocate a positive remittance amount.']);
        }

        return DB::transaction(function () use ($organization, $reference, $currency, $allocations, $total): CodRemittanceBatch {
            $existing = CodRemittanceBatch::query()->where('logistics_organization_id', $organization->id)->where('reference', $reference)->first();
            if ($existing !== null) {
                return $existing->load('allocations');
            }
            foreach ($allocations as $index => $allocation) {
                $order = Order::query()->whereKey($allocation['order_id'])
                    ->where('currency', $currency)->where('status', OrderStatus::Delivered)->where('payment_status', PaymentStatus::Paid)
                    ->whereHas('waybill', fn ($query) => $query->where('logistics_organization_id', $organization->id))
                    ->lockForUpdate()->first();
                if ($order === null) {
                    throw ValidationException::withMessages(["allocations.{$index}.order_id" => 'This delivered COD Order is not remittable by your organization.']);
                }
                $cleared = (int) DB::table('cod_remittance_allocations')->join('cod_remittance_batches', 'cod_remittance_batches.id', '=', 'cod_remittance_allocations.cod_remittance_batch_id')
                    ->where('cod_remittance_allocations.order_id', $order->id)->where('cod_remittance_batches.status', 'cleared')->sum('cod_remittance_allocations.amount_cents');
                if ($cleared + (int) $allocation['amount_cents'] > $this->cents($order->payable_total)) {
                    throw ValidationException::withMessages(["allocations.{$index}.amount_cents" => 'The allocation exceeds the unremitted COD balance.']);
                }
            }
            $batch = CodRemittanceBatch::create([
                'logistics_organization_id' => $organization->id, 'reference' => $reference,
                'status' => 'submitted', 'currency' => $currency, 'total_cents' => $total, 'submitted_at' => now(),
            ]);
            foreach ($allocations as $allocation) {
                $batch->allocations()->create($allocation);
            }

            return $batch->load('allocations');
        }, 3);
    }

    public function clearRemittance(User $admin, string $batchId): CodRemittanceBatch
    {
        return DB::transaction(function () use ($admin, $batchId): CodRemittanceBatch {
            $batch = CodRemittanceBatch::query()->whereKey($batchId)->with('allocations')->lockForUpdate()->firstOrFail();
            if ($batch->status === 'cleared') {
                return $batch;
            }
            abort_if($batch->status !== 'submitted', 409, 'Only submitted remittances can be cleared.');
            foreach ($batch->allocations as $allocation) {
                $order = Order::query()->whereKey($allocation->order_id)->lockForUpdate()->firstOrFail();
                $alreadyCleared = (int) DB::table('cod_remittance_allocations')->join('cod_remittance_batches', 'cod_remittance_batches.id', '=', 'cod_remittance_allocations.cod_remittance_batch_id')
                    ->where('cod_remittance_allocations.order_id', $order->id)->where('cod_remittance_batches.status', 'cleared')->sum('cod_remittance_allocations.amount_cents');
                abort_if($alreadyCleared + $allocation->amount_cents > $this->cents($order->payable_total), 409, 'Clearing would overfund an Order.');
                $this->ledger->post('remittance:'.$batch->id.':'.$order->id, 'cod_remitted', $batch->currency, [
                    ['account_code' => 'cash', 'owner_type' => 'platform', 'debit_cents' => $allocation->amount_cents],
                    ['account_code' => 'cod_receivable', 'owner_type' => 'platform', 'credit_cents' => $allocation->amount_cents],
                ], now(), $order->id, 'COD remittance receipt cleared by Admin.');
            }
            $batch->update(['status' => 'cleared', 'cleared_by_admin_id' => $admin->id, 'cleared_at' => now()]);

            return $batch->refresh()->load('allocations');
        }, 3);
    }

    /** @param array<string, mixed> $scope @param array<string, mixed> $data */
    public function expense(User $actor, array $scope, array $data): FinanceExpense
    {
        return DB::transaction(function () use ($actor, $scope, $data): FinanceExpense {
            $correction = null;
            if (! empty($data['correction_of_id'])) {
                $correction = FinanceExpense::query()->whereKey($data['correction_of_id'])->where($scope)->lockForUpdate()->first();
                if ($correction === null || $correction->correction_of_id !== null) {
                    throw ValidationException::withMessages(['correction_of_id' => 'Select an original expense in your Finance workspace.']);
                }
                $corrected = (int) FinanceExpense::query()->where('correction_of_id', $correction->id)->sum('amount_cents');
                if ($corrected + (int) $data['amount_cents'] > $correction->amount_cents) {
                    throw ValidationException::withMessages(['amount_cents' => 'The correction exceeds the remaining original expense.']);
                }
                $data['linehaul_trip_id'] ??= $correction->linehaul_trip_id;
            }
            $orderIds = collect();
            if (! empty($data['linehaul_trip_id'])) {
                if ($scope['owner_type'] !== 'logistics') {
                    throw ValidationException::withMessages(['linehaul_trip_id' => 'Only Logistics expenses may be allocated to a linehaul trip.']);
                }
                $trip = LinehaulTrip::query()->whereKey($data['linehaul_trip_id'])
                    ->where('owner_logistics_organization_id', $scope['owner_id'])
                    ->with('shipments.shipment.parcel')->first();
                if ($trip === null) {
                    throw ValidationException::withMessages(['linehaul_trip_id' => 'Select a linehaul trip owned by your organization.']);
                }
                $orderIds = $trip->shipments->pluck('shipment.parcel.order_id')->filter()->unique()->sort()->values();
                if ($orderIds->isEmpty()) {
                    throw ValidationException::withMessages(['linehaul_trip_id' => 'The selected trip has no carried parcels to allocate.']);
                }
            }
            $expense = FinanceExpense::create([
                ...$scope, ...$data, 'currency' => 'PHP', 'recorded_by' => $actor->id,
            ]);
            if ($orderIds->isNotEmpty()) {
                $base = intdiv($expense->amount_cents, $orderIds->count());
                $remainder = $expense->amount_cents % $orderIds->count();
                foreach ($orderIds as $index => $orderId) {
                    $expense->allocations()->create(['order_id' => $orderId, 'amount_cents' => $base + ($index < $remainder ? 1 : 0)]);
                }
            }
            $expenseAccount = $orderIds->isNotEmpty() ? 'delivery_cost' : 'operating_expense';
            $lines = $correction === null
                ? [
                    ['account_code' => $expenseAccount, ...$scope, 'debit_cents' => $expense->amount_cents],
                    ['account_code' => 'expense_funding', ...$scope, 'credit_cents' => $expense->amount_cents],
                ]
                : [
                    ['account_code' => 'expense_funding', ...$scope, 'debit_cents' => $expense->amount_cents],
                    ['account_code' => $expenseAccount, ...$scope, 'credit_cents' => $expense->amount_cents],
                ];
            $this->ledger->post('expense:'.$expense->id, $correction === null ? 'expense_recorded' : 'expense_correction', 'PHP', $lines, CarbonImmutable::parse($expense->incurred_on, 'Asia/Manila')->startOfDay()->utc(), null, $expense->description);

            return $expense->load('allocations');
        });
    }

    /** @param array<string, mixed> $scope */
    public function closePeriod(User $actor, array $scope, string $month, bool $costsComplete): FinancePeriodClosure
    {
        if (! $costsComplete) {
            throw ValidationException::withMessages(['costs_complete' => 'Confirm cost completeness before closing a month.']);
        }
        $period = CarbonImmutable::createFromFormat('Y-m', $month, 'Asia/Manila')->startOfMonth();
        abort_if($period->isCurrentMonth(), 409, 'The current month is still open.');

        return FinancePeriodClosure::query()->firstOrCreate(
            [...$scope, 'period_month' => $period->toDateString()],
            ['costs_complete' => true, 'closed_by' => $actor->id, 'closed_at' => now()],
        );
    }

    public function placeHold(User $admin, string $orderId, string $reason, ?string $notes): FinancialHold
    {
        Order::query()->findOrFail($orderId);

        return FinancialHold::create(['order_id' => $orderId, 'reason_code' => $reason, 'notes' => $notes, 'placed_by' => $admin->id, 'placed_at' => now()]);
    }

    public function releaseHold(User $admin, string $holdId): FinancialHold
    {
        $hold = FinancialHold::query()->findOrFail($holdId);
        if ($hold->released_at === null) {
            if (in_array($hold->reason_code, ['LOGISTICS_EVIDENCE_MISSING', 'LINEHAUL_EVIDENCE_MISSING'], true)) {
                $order = Order::query()->with(['pricingSnapshot', 'waybill.parcel.shipment'])->findOrFail($hold->order_id);
                $shipment = $order->waybill?->parcel?->shipment;
                abort_if($shipment === null || $order->pricingSnapshot === null, 409, 'Logistics allocation evidence is still incomplete.');
                $allocation = $this->logisticsAllocation->allocate($order, $shipment, $order->pricingSnapshot->logistics_pool_cents);
                abort_if($allocation['held'], 409, 'Logistics allocation evidence is still incomplete.');
                $this->logisticsAllocation->commit($order, $allocation['allocations']);
                $lines = [[
                    'account_code' => 'logistics_allocation_pending', 'owner_type' => 'platform',
                    'debit_cents' => $order->pricingSnapshot->logistics_pool_cents,
                ]];
                foreach (collect($allocation['allocations'])->groupBy('organization_id') as $organizationId => $shares) {
                    $lines[] = [
                        'account_code' => 'logistics_liability', 'owner_type' => 'logistics',
                        'owner_id' => $organizationId, 'credit_cents' => $shares->sum('amount_cents'),
                    ];
                }
                $this->ledger->post('logistics-allocation:'.$order->id, 'logistics_allocation_resolved', $order->currency, $lines, now(), $order->id, 'Held Logistics service allocation resolved from completed evidence.');
            }
            $hold->update(['released_by' => $admin->id, 'released_at' => now()]);
        }

        return $hold->refresh();
    }

    private function cents(mixed $amount): int
    {
        [$whole, $fraction] = array_pad(explode('.', (string) $amount, 2), 2, '');

        return ((int) $whole * 100) + (int) str_pad(substr($fraction, 0, 2), 2, '0');
    }
}
