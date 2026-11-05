<?php

namespace App\Services\Finance;

use App\Models\CodRemittanceBatch;
use App\Models\FinanceExpense;
use App\Models\FinanceJournalEntry;
use App\Models\FinanceLedgerLine;
use App\Models\FinancePayout;
use App\Models\FinancePeriodClosure;
use App\Models\Order;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class FinanceReportService
{
    /** @return array{owner_type: string, owner_id: string|null, revenue_account: string} */
    public function scope(User $user, string $role): array
    {
        return match ($role) {
            'seller' => ['owner_type' => 'seller', 'owner_id' => $user->shop()->firstOrFail()->id, 'revenue_account' => 'seller_liability'],
            'logistics' => ['owner_type' => 'logistics', 'owner_id' => $user->logisticsOrganization()->firstOrFail()->id, 'revenue_account' => 'logistics_liability'],
            default => ['owner_type' => 'platform', 'owner_id' => null, 'revenue_account' => 'commission_revenue'],
        };
    }

    /** @param array<string, mixed> $scope @return array<string, mixed> */
    public function workspace(array $scope, array $filters = []): array
    {
        $periodLines = $this->periodLines($scope, $filters);
        $revenue = (int) $periodLines->where('account_code', $scope['revenue_account'])->sum('credit_cents');
        $costAccounts = $this->costAccounts($scope);
        $costs = (int) $periodLines->whereIn('account_code', $costAccounts)->sum(fn ($line) => $line->debit_cents - $line->credit_cents);
        $liability = $scope['owner_type'] === 'platform'
            ? $this->platformBalance($scope, $costAccounts)
            : (int) $this->lines($scope)->where('account_code', $scope['revenue_account'])->sum(fn ($line) => $line->credit_cents - $line->debit_cents);
        $closed = $this->periodClosed($scope, $filters);
        $breakdown = $periodLines->where(fn ($line) => $line->credit_cents > 0)->groupBy('account_code')
            ->map(fn (Collection $lines, string $account) => ['label' => str($account)->replace('_', ' ')->title()->toString(), 'amountCents' => $lines->sum('credit_cents')])->values();

        return [
            'currency' => 'PHP', 'timezone' => 'Asia/Manila', 'generatedAt' => now()->toISOString(),
            'summary' => ['revenueCents' => $revenue, 'costsCents' => $costs, 'profitCents' => $revenue - $costs, 'availableBalanceCents' => $liability, 'profitState' => $closed ? 'actual' : 'provisional'],
            'period' => ['dateFrom' => $filters['date_from'] ?? null, 'dateTo' => $filters['date_to'] ?? null, 'allTime' => (bool) ($filters['all_time'] ?? false)],
            'series' => $this->series($scope, $filters), 'waterfall' => [
                ['label' => 'Revenue', 'amountCents' => $revenue], ['label' => 'Costs', 'amountCents' => -$costs], ['label' => 'Operating profit', 'amountCents' => $revenue - $costs],
            ],
            'revenueBreakdown' => $breakdown, 'remittanceAging' => $this->remittanceAging($scope),
            'payoutSchedule' => $this->payouts($scope), 'forecast' => $this->forecast($scope),
            'moneyFlow' => $this->moneyFlow($scope),
        ];
    }

    /** @param array<string, mixed> $scope */
    public function ledger(array $scope, array $filters = []): mixed
    {
        return FinanceDateRange::apply($this->journalQuery($scope), 'effective_at', $filters)
            ->when($filters['search'] ?? null, function (Builder $query, string $search): void {
                $query->where(fn (Builder $nested) => $nested->where('event_type', 'like', '%'.$search.'%')->orWhere('memo', 'like', '%'.$search.'%')->orWhereHas('order', fn ($order) => $order->where('reference', 'like', '%'.$search.'%')));
            })
            ->with(['lines' => fn ($query) => $query->where($this->ownerConditions($scope)), 'order:id,reference'])
            ->latest('effective_at')->orderByDesc('id')->paginate(min(100, max(1, (int) ($filters['per_page'] ?? 25))));
    }

    /** @param array<string, mixed> $scope */
    public function order(array $scope, string $orderId): Order
    {
        $query = Order::query()->whereKey($orderId);
        if ($scope['owner_type'] === 'seller') {
            $query->where('shop_id', $scope['owner_id']);
        } elseif ($scope['owner_type'] === 'logistics') {
            $query->whereHas('pricingSnapshot', fn ($snapshot) => $snapshot->whereJsonContains('eligible_logistics_organization_ids', $scope['owner_id']))
                ->whereHas('waybill', fn ($waybill) => $waybill->where('logistics_organization_id', $scope['owner_id']));
        }

        return $query->with(['items', 'vouchers', 'pricingSnapshot.rate', 'pricingSnapshot', 'statusEvents', 'waybill.parcel.shipment.route.hops'])->firstOrFail();
    }

    /** @param array<string, mixed> $scope @return list<array<string, mixed>> */
    public function series(array $scope, array $filters = []): array
    {
        $today = CarbonImmutable::now('Asia/Manila')->startOfDay();
        $start = FinanceDateRange::start($filters)?->timezone('Asia/Manila') ?? $today->subDays(89);
        if ($filters['all_time'] ?? false) {
            $first = $this->journalQuery($scope)->min('effective_at');
            $start = $first ? CarbonImmutable::parse($first, 'UTC')->timezone('Asia/Manila')->startOfDay() : $today;
        }
        $end = isset($filters['date_to']) ? CarbonImmutable::parse($filters['date_to'], 'Asia/Manila') : $today;
        $format = 'Y-m-d';
        $lines = $this->periodLines($scope, ['date_from' => $start->toDateString(), 'date_to' => $end->toDateString()])
            ->groupBy(fn ($line) => $line->journal->effective_at->timezone('Asia/Manila')->format($format));
        $rows = [];
        for ($date = $start; $date->lte($end); $date = $date->addDay()) {
            $day = $lines->get($date->format($format), collect());
            $revenue = $day->where('account_code', $scope['revenue_account'])->sum('credit_cents');
            $costs = $day->whereIn('account_code', $this->costAccounts($scope))->sum(fn ($line) => $line->debit_cents - $line->credit_cents);
            $rows[] = ['date' => $date->toDateString(), 'actualRevenueCents' => $revenue, 'actualProfitCents' => $revenue - $costs];
        }

        return $rows;
    }

    private function periodClosed(array $scope, array $filters): bool
    {
        if (empty($filters['date_from']) || empty($filters['date_to'])) {
            return false;
        }
        $first = CarbonImmutable::parse($filters['date_from'], 'Asia/Manila')->startOfMonth();
        $last = CarbonImmutable::parse($filters['date_to'], 'Asia/Manila')->startOfMonth();
        if ($last->gte(CarbonImmutable::now('Asia/Manila')->startOfMonth())) {
            return false;
        }
        $required = (int) $first->diffInMonths($last) + 1;
        $closed = FinancePeriodClosure::query()->where($this->ownerConditions($scope))->where('costs_complete', true)
            ->whereBetween('period_month', [$first->toDateString(), $last->endOfMonth()->toDateString()])->distinct()->count('period_month');

        return $closed === $required;
    }

    private function periodLines(array $scope, array $filters): Collection
    {
        return FinanceLedgerLine::query()->where($this->ownerConditions($scope))
            ->whereHas('journal', fn ($query) => FinanceDateRange::apply($query, 'effective_at', $filters))
            ->with('journal')->get();
    }

    private function costAccounts(array $scope): array
    {
        return $scope['owner_type'] === 'platform'
            ? ['voucher_expense', 'shipping_subsidy_expense', 'operating_expense', 'recorded_loss', 'processing_fee']
            : ['operating_expense', 'product_cost', 'delivery_cost'];
    }

    private function platformBalance(array $scope, array $costAccounts): int
    {
        $lines = $this->lines($scope);
        $revenue = (int) $lines->where('account_code', $scope['revenue_account'])->sum('credit_cents');
        $costs = (int) $lines->whereIn('account_code', $costAccounts)->sum(fn ($line) => $line->debit_cents - $line->credit_cents);

        return max(0, $revenue - $costs);
    }

    /** @param array<string, mixed> $scope @return array<string, mixed> */
    public function forecast(array $scope): array
    {
        $manila = CarbonImmutable::now('Asia/Manila');
        $end = $manila->startOfWeek()->subDay()->endOfDay();
        $start = $end->subWeeks(8)->addDay()->startOfDay();
        $lines = $this->lines($scope, $start->utc(), $end->utc());
        $revenueLines = $lines->where('account_code', $scope['revenue_account'])->where('credit_cents', '>', 0);
        $weeks = $revenueLines->map(fn ($line) => $line->journal->effective_at->timezone('Asia/Manila')->format('o-W'))->unique()->count();
        $complete = $this->costCoverageComplete($scope, $start, $end);
        if ($weeks < 8) {
            return ['state' => 'insufficient_history', 'usableWeeks' => $weeks, 'requiredWeeks' => 8, 'profitSuppressed' => true, 'series' => [], 'scenarios' => []];
        }
        $dailyRevenue = $revenueLines->groupBy(fn ($line) => $line->journal->effective_at->timezone('Asia/Manila')->dayOfWeekIso)->map->sum('credit_cents');
        $costLines = $lines->whereIn('account_code', ['voucher_expense', 'shipping_subsidy_expense', 'operating_expense', 'product_cost', 'delivery_cost', 'processing_fee', 'recorded_loss']);
        $dailyCost = $costLines->groupBy(fn ($line) => $line->journal->effective_at->timezone('Asia/Manila')->dayOfWeekIso)
            ->map(fn (Collection $day) => $day->sum(fn ($line) => $line->debit_cents - $line->credit_cents));
        $recurring = FinanceExpense::query()->where($this->ownerConditions($scope))->where('is_recurring_monthly', true)->get(['amount_cents', 'incurred_on']);
        $baseRevenue = 0;
        $baseVariableCosts = 0;
        $baseRecurringCosts = 0;
        $projection = [];
        for ($day = 1; $day <= 30; $day++) {
            $date = $manila->addDays($day);
            $weekday = $date->dayOfWeekIso;
            $revenue = intdiv((int) $dailyRevenue->get($weekday, 0), 8);
            $variableCosts = intdiv((int) $dailyCost->get($weekday, 0), 8);
            $recurringCosts = (int) $recurring->filter(fn (FinanceExpense $expense) => min($expense->incurred_on->day, $date->daysInMonth) === $date->day)->sum('amount_cents');
            $baseRevenue += $revenue;
            $baseVariableCosts += $variableCosts;
            $baseRecurringCosts += $recurringCosts;
            $projection[] = [
                'date' => $date->toDateString(),
                'forecastLowRevenueCents' => intdiv($revenue * 80, 100),
                'forecastRevenueCents' => $revenue,
                'forecastHighRevenueCents' => intdiv($revenue * 120, 100),
                'forecastVariableCostsCents' => $variableCosts,
                'scheduledRecurringCostsCents' => $recurringCosts,
            ];
        }
        $scenarios = collect(['low' => 80, 'base' => 100, 'high' => 120])->map(function (int $activity, string $label) use ($baseRevenue, $baseVariableCosts, $baseRecurringCosts, $complete): array {
            $revenue = intdiv($baseRevenue * $activity, 100);
            $variableCosts = intdiv($baseVariableCosts * $activity, 100);

            return ['label' => $label, 'activityPercent' => $activity, 'revenueCents' => $revenue, 'variableCostsCents' => $variableCosts, 'scheduledRecurringCostsCents' => $baseRecurringCosts, 'profitCents' => $complete ? $revenue - $variableCosts - $baseRecurringCosts : null];
        })->values()->all();

        return ['state' => 'available', 'usableWeeks' => 8, 'requiredWeeks' => 8, 'profitSuppressed' => ! $complete, 'series' => $projection, 'scenarios' => $scenarios];
    }

    /** @param array<string, mixed> $scope */
    private function lines(array $scope, mixed $from = null, mixed $to = null): Collection
    {
        return FinanceLedgerLine::query()->where($this->ownerConditions($scope))
            ->whereHas('journal', fn ($query) => $query->when($from, fn ($q) => $q->where('effective_at', '>=', $from))->when($to, fn ($q) => $q->where('effective_at', '<=', $to)))
            ->with('journal')->get();
    }

    /** @param array<string, mixed> $scope */
    private function journalQuery(array $scope): Builder
    {
        return FinanceJournalEntry::query()->whereHas('lines', fn ($query) => $query->where($this->ownerConditions($scope)));
    }

    /** @param array<string, mixed> $scope @return array<string, mixed> */
    private function ownerConditions(array $scope): array
    {
        return $scope['owner_id'] === null ? ['owner_type' => $scope['owner_type']] : ['owner_type' => $scope['owner_type'], 'owner_id' => $scope['owner_id']];
    }

    /** @param array<string, mixed> $scope @return array<string, mixed> */
    private function remittanceAging(array $scope): array
    {
        $query = CodRemittanceBatch::query();
        if ($scope['owner_type'] === 'logistics') {
            $query->where('logistics_organization_id', $scope['owner_id']);
        } elseif ($scope['owner_type'] === 'seller') {
            $query->whereHas('allocations', fn ($allocation) => $allocation->whereHas('order', fn ($order) => $order->where('shop_id', $scope['owner_id'])));
        }
        $batches = $query->get();

        return ['submittedCents' => $batches->where('status', 'submitted')->sum('total_cents'), 'clearedCents' => $batches->where('status', 'cleared')->sum('total_cents'), 'oldestSubmittedAt' => $batches->where('status', 'submitted')->min('submitted_at')?->toISOString()];
    }

    /** @param array<string, mixed> $scope @return list<array<string, mixed>> */
    private function payouts(array $scope): array
    {
        $query = FinancePayout::query();
        if ($scope['owner_type'] !== 'platform') {
            $query->where('beneficiary_type', $scope['owner_type'])->where('beneficiary_id', $scope['owner_id']);
        }

        return $query->latest()->limit(20)->get()->map(fn ($payout) => ['id' => $payout->id, 'amountCents' => $payout->amount_cents, 'currency' => $payout->currency, 'status' => $payout->status, 'eligibleThrough' => $payout->eligible_through->toISOString(), 'isSandbox' => $payout->is_sandbox])->all();
    }

    /** @param array<string, mixed> $scope @return array<string, mixed> */
    private function moneyFlow(array $scope): array
    {
        return ['nodes' => [
            ['id' => 'customer', 'label' => 'Customer COD'], ['id' => 'platform', 'label' => 'Aisley clearing'],
            ['id' => 'seller', 'label' => 'Seller proceeds'], ['id' => 'logistics', 'label' => 'Logistics services'], ['id' => 'commission', 'label' => 'Platform commission'],
        ], 'edges' => [
            ['id' => 'cod', 'source' => 'customer', 'target' => 'platform', 'label' => 'Full COD remittance'],
            ['id' => 'seller-payout', 'source' => 'platform', 'target' => 'seller', 'label' => 'Configured eligible Seller payout'],
            ['id' => 'logistics-payout', 'source' => 'platform', 'target' => 'logistics', 'label' => 'Evidence-based shares'],
            ['id' => 'commission-retained', 'source' => 'platform', 'target' => 'commission', 'label' => 'Commission retained'],
        ], 'scope' => $scope['owner_type']];
    }

    /** @param array<string, mixed> $scope */
    private function costCoverageComplete(array $scope, CarbonImmutable $start, CarbonImmutable $end): bool
    {
        if ($scope['owner_type'] === 'seller') {
            return ! Order::query()->where('shop_id', $scope['owner_id'])->where('status', 'delivered')
                ->whereBetween('updated_at', [$start->utc(), $end->utc()])->whereHas('items', fn ($query) => $query->whereNull('unit_cost_cents'))->exists();
        }

        return FinancePeriodClosure::query()->where($this->ownerConditions($scope))->where('costs_complete', true)
            ->whereBetween('period_month', [$start->startOfMonth()->toDateString(), $end->startOfMonth()->toDateString()])->count() >= 2;
    }
}
