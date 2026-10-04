<?php

namespace App\Services\Finance;

use App\Models\CodRemittanceBatch;
use App\Models\FinanceExpense;
use App\Models\FinancePeriodClosure;
use App\Models\FinancialHold;
use App\Models\LinehaulTrip;
use App\Models\LogisticsRouteReconciliation;
use App\Models\LogisticsServiceAllocation;
use App\Models\Order;
use App\Models\User;
use App\Services\Finance\Automation\RemittanceService;
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
        return app(RemittanceService::class)->submit($logistics, $reference, $currency, $allocations);
    }

    public function clearRemittance(User $admin, string $batchId): CodRemittanceBatch
    {
        return app(RemittanceService::class)->clear($batchId, $admin);
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
        return DB::transaction(function () use ($admin, $orderId, $reason, $notes) {
            Order::query()->whereKey($orderId)->lockForUpdate()->firstOrFail();
            $reserved = DB::table('finance_payout_items')->join('finance_payouts', 'finance_payouts.id', '=', 'finance_payout_items.finance_payout_id')
                ->where('finance_payout_items.order_id', $orderId)->whereNull('finance_payout_items.released_at')->whereIn('finance_payouts.status', ['reserved', 'pending'])->exists();
            abort_if($reserved, 409, 'Order funds are already reserved for payout. Reconcile the payment before placing a hold.');

            return FinancialHold::create(['order_id' => $orderId, 'reason_code' => $reason, 'notes' => $notes, 'placed_by' => $admin->id, 'placed_at' => now()]);
        }, 3);
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
            abort_if(in_array($hold->reason_code, ['UNPLANNED_ROUTE_RECONCILIATION_REQUIRED', 'LOGISTICS_QUOTED_CHARGES_MISSING'], true), 409, 'Reconcile the Logistics allocations before releasing this hold.');
            $hold->update(['released_by' => $admin->id, 'released_at' => now()]);
        }

        return $hold->refresh();
    }

    /** @param array<string, mixed> $data */
    public function reconcileLogistics(User $admin, string $holdId, array $data): LogisticsRouteReconciliation
    {
        return DB::transaction(function () use ($admin, $holdId, $data): LogisticsRouteReconciliation {
            $hold = FinancialHold::query()->whereKey($holdId)->whereNull('released_at')->lockForUpdate()->firstOrFail();
            abort_unless(in_array($hold->reason_code, [
                'UNPLANNED_ROUTE_RECONCILIATION_REQUIRED',
                'LOGISTICS_QUOTED_CHARGES_MISSING',
                'LOGISTICS_EVIDENCE_MISSING',
                'LINEHAUL_EVIDENCE_MISSING',
            ], true), 409, 'This hold does not support Logistics reconciliation.');
            $order = Order::query()->with('pricingSnapshot')->whereKey($hold->order_id)->lockForUpdate()->firstOrFail();
            abort_if($order->pricingSnapshot === null, 409, 'The Order has no pricing snapshot.');
            $subsidy = (int) ($data['platform_subsidy_cents'] ?? 0);
            $pool = $order->pricingSnapshot->logistics_pool_cents;
            $total = collect($data['allocations'])->sum('amount_cents');
            if ($total !== $pool + $subsidy) {
                throw ValidationException::withMessages(['allocations' => 'Allocations must equal the frozen Logistics pool plus the declared platform subsidy.']);
            }
            $keys = collect($data['allocations'])->map(fn (array $entry) => $entry['logistics_organization_id'].':'.$entry['service_type']);
            if ($keys->unique()->count() !== $keys->count()) {
                throw ValidationException::withMessages(['allocations' => 'Combine duplicate organization and service allocations.']);
            }
            $reconciliation = LogisticsRouteReconciliation::create([
                'order_id' => $order->id,
                'financial_hold_id' => $hold->id,
                'shipping_pool_cents' => $pool,
                'platform_subsidy_cents' => $subsidy,
                'total_allocation_cents' => $total,
                'allocations' => $data['allocations'],
                'notes' => $data['notes'],
                'reconciled_by' => $admin->id,
                'reconciled_at' => now(),
            ]);
            foreach ($data['allocations'] as $allocation) {
                LogisticsServiceAllocation::create([
                    'order_id' => $order->id,
                    'logistics_organization_id' => $allocation['logistics_organization_id'],
                    'service_type' => $allocation['service_type'],
                    'shipment_route_hop_id' => null,
                    'quoted_charge_cents' => null,
                    'amount_cents' => $allocation['amount_cents'],
                    'status' => 'reconciled',
                    'committed_at' => now(),
                ]);
            }
            $lines = [[
                'account_code' => 'logistics_allocation_pending',
                'owner_type' => 'platform',
                'debit_cents' => $pool,
            ]];
            if ($subsidy > 0) {
                $lines[] = ['account_code' => 'shipping_subsidy_expense', 'owner_type' => 'platform', 'debit_cents' => $subsidy];
            }
            foreach (collect($data['allocations'])->groupBy('logistics_organization_id') as $organizationId => $allocations) {
                $lines[] = [
                    'account_code' => 'logistics_liability',
                    'owner_type' => 'logistics',
                    'owner_id' => $organizationId,
                    'credit_cents' => $allocations->sum('amount_cents'),
                ];
            }
            $this->ledger->post('logistics-reconciliation:'.$order->id, 'logistics_route_reconciled', $order->currency, $lines, now(), $order->id, $data['notes']);
            $hold->update(['released_by' => $admin->id, 'released_at' => now()]);

            return $reconciliation;
        }, 3);
    }

    private function cents(mixed $amount): int
    {
        [$whole, $fraction] = array_pad(explode('.', (string) $amount, 2), 2, '');

        return ((int) $whole * 100) + (int) str_pad(substr($fraction, 0, 2), 2, '0');
    }
}
