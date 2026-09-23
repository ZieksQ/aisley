<?php

namespace App\Http\Controllers\Finance;

use App\Http\Controllers\Controller;
use App\Services\Finance\FinanceReportService;
use App\Services\Finance\FinanceWorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

abstract class AbstractFinanceController extends Controller
{
    abstract protected function role(): string;

    public function show(Request $request, FinanceReportService $reports): JsonResponse
    {
        return response()->json(['data' => $reports->workspace($reports->scope($request->user(), $this->role()))])->header('Cache-Control', 'private, no-store');
    }

    public function ledger(Request $request, FinanceReportService $reports): JsonResponse
    {
        $filters = $request->validate(['search' => ['nullable', 'string', 'max:120'], 'per_page' => ['nullable', 'integer', 'between:1,100']]);
        $page = $reports->ledger($reports->scope($request->user(), $this->role()), $filters);

        return response()->json($page)->header('Cache-Control', 'private, no-store');
    }

    public function csv(Request $request, FinanceReportService $reports): StreamedResponse
    {
        $scope = $reports->scope($request->user(), $this->role());
        $page = $reports->ledger($scope, ['search' => $request->string('search')->toString(), 'per_page' => 100]);

        return response()->streamDownload(function () use ($page): void {
            $output = fopen('php://output', 'w');
            fputcsv($output, ['effective_at', 'event_type', 'order_reference', 'account', 'debit_cents', 'credit_cents', 'currency']);
            foreach ($page->items() as $journal) {
                foreach ($journal->lines as $line) {
                    fputcsv($output, [$journal->effective_at->toISOString(), $journal->event_type, $journal->order?->reference, $line->account_code, $line->debit_cents, $line->credit_cents, $journal->currency]);
                }
            }
            fclose($output);
        }, 'aisley-finance-ledger.csv', ['Content-Type' => 'text/csv; charset=UTF-8', 'Cache-Control' => 'private, no-store']);
    }

    public function order(Request $request, string $order, FinanceReportService $reports): JsonResponse
    {
        $scope = $reports->scope($request->user(), $this->role());
        $record = $reports->order($scope, $order);
        $snapshot = $record->pricingSnapshot;
        $eligible = $this->role() === 'logistics' ? collect($snapshot?->eligible_logistics_organization_ids)->filter(fn ($id) => $id === $scope['owner_id'])->values()->all() : $snapshot?->eligible_logistics_organization_ids;

        return response()->json(['data' => [
            'id' => $record->id, 'reference' => $record->reference, 'currency' => $record->currency,
            'status' => $record->status->value, 'paymentStatus' => $record->payment_status->value,
            'totals' => ['merchandiseCents' => $this->cents($record->merchandise_subtotal), 'shippingCents' => $this->cents($record->shipping_fee), 'merchandiseDiscountCents' => $this->cents($record->discount_total), 'shippingDiscountCents' => $this->cents($record->shipping_discount_total), 'codTotalCents' => $this->cents($record->payable_total)],
            'pricing' => $snapshot === null ? null : [
                'rateVersion' => $snapshot->rate->version_number, 'billableWeightGrams' => $snapshot->billable_weight_grams,
                'sellerCommissionCents' => $snapshot->seller_commission_cents, 'sellerProceedsCents' => $snapshot->seller_proceeds_cents,
                'logisticsCommissionCents' => $snapshot->logistics_commission_cents, 'logisticsPoolCents' => $snapshot->logistics_pool_cents,
                'voucherFunding' => $snapshot->voucher_funding, 'eligibleLogisticsOrganizationIds' => $eligible,
            ],
            'items' => $record->items->map(fn ($item) => ['name' => $item->product_name, 'sku' => $item->sku, 'quantity' => $item->quantity, 'unitPrice' => $item->unit_price, 'unitCostCents' => $item->unit_cost_cents]),
            'settlementHistory' => $record->statusEvents->map(fn ($event) => ['status' => $event->to_status->value, 'occurredAt' => $event->occurred_at->toISOString()]),
        ]])->header('Cache-Control', 'private, no-store');
    }

    public function expense(Request $request, FinanceReportService $reports, FinanceWorkflowService $workflow): JsonResponse
    {
        $data = $request->validate([
            'category' => ['required', 'string', 'max:80'], 'description' => ['required', 'string', 'max:500'],
            'amount_cents' => ['required', 'integer', 'min:1'], 'incurred_on' => ['required', 'date'],
            'is_recurring_monthly' => ['sometimes', 'boolean'], 'correction_of_id' => ['nullable', 'uuid'],
            'linehaul_trip_id' => ['nullable', 'uuid'],
        ]);
        $scope = $reports->scope($request->user(), $this->role());
        unset($scope['revenue_account']);

        return response()->json(['data' => $workflow->expense($request->user(), $scope, $data)], 201);
    }

    public function close(Request $request, string $month, FinanceReportService $reports, FinanceWorkflowService $workflow): JsonResponse
    {
        $request->validate(['costs_complete' => ['required', Rule::in([true, 1, '1'])]]);
        abort_unless(preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month), 422, 'Month must use YYYY-MM.');
        $scope = $reports->scope($request->user(), $this->role());
        unset($scope['revenue_account']);

        return response()->json(['data' => $workflow->closePeriod($request->user(), $scope, $month, true)]);
    }

    private function cents(mixed $amount): int
    {
        [$whole, $fraction] = array_pad(explode('.', (string) $amount, 2), 2, '');

        return ((int) $whole * 100) + (int) str_pad(substr($fraction, 0, 2), 2, '0');
    }
}
