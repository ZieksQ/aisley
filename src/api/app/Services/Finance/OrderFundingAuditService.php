<?php

namespace App\Services\Finance;

use App\Enums\OrderStatus;
use App\Models\FinanceJournalEntry;
use App\Models\OrderPricingSnapshot;
use Illuminate\Support\Collection;

class OrderFundingAuditService
{
    public function __construct(private readonly OrderSnapshotFunding $funding) {}

    /**
     * Stream discrepant snapshots without retaining the complete inventory.
     * Positive differences are shortfalls; negative differences are surpluses.
     *
     * @return array{scanned_snapshots: int, discrepancies: int, totals_by_currency: array}
     */
    public function scan(callable $emit, ?string $orderId = null): array
    {
        $summary = ['scanned_snapshots' => 0, 'discrepancies' => 0, 'totals_by_currency' => []];
        OrderPricingSnapshot::query()->with('order:id,status')
            ->when($orderId !== null, fn ($query) => $query->where('order_id', $orderId))
            ->chunkById(200, function (Collection $snapshots) use ($emit, &$summary): void {
                $recognized = FinanceJournalEntry::query()->where('event_type', 'delivery_recognized')
                    ->whereIn('order_id', $snapshots->pluck('order_id'))->pluck('order_id')->flip();
                foreach ($snapshots as $snapshot) {
                    $summary['scanned_snapshots']++;
                    $amounts = $this->funding->inspect($snapshot);
                    if ($amounts['difference_cents'] === 0) {
                        continue;
                    }
                    $status = $snapshot->order->status;
                    $isRecognized = $recognized->has($snapshot->order_id);
                    $terminal = in_array($status, [
                        OrderStatus::Delivered, OrderStatus::Cancelled, OrderStatus::Rejected,
                        OrderStatus::DeliveryFailed, OrderStatus::ReturnRequested, OrderStatus::Returned,
                    ], true);
                    $classification = $isRecognized ? 'already_recognized' : ($terminal ? 'terminal' : 'outstanding');
                    $emit([
                        'order_id' => $snapshot->order_id, 'snapshot_id' => $snapshot->id,
                        'order_status' => $status->value, 'currency' => $snapshot->currency,
                        ...$amounts, 'recognized' => $isRecognized, 'classification' => $classification,
                    ]);
                    $summary['discrepancies']++;
                    $totals = $summary['totals_by_currency'][$snapshot->currency] ?? [
                        'count' => 0, 'outstanding' => 0, 'terminal' => 0, 'already_recognized' => 0,
                        'funding_cents' => 0, 'obligations_cents' => 0,
                        'shortfall_cents' => 0, 'surplus_cents' => 0,
                    ];
                    $totals['count']++;
                    $totals[$classification]++;
                    $totals['funding_cents'] += $amounts['funding_cents'];
                    $totals['obligations_cents'] += $amounts['obligations_cents'];
                    $totals['shortfall_cents'] += max(0, $amounts['difference_cents']);
                    $totals['surplus_cents'] += max(0, -$amounts['difference_cents']);
                    $summary['totals_by_currency'][$snapshot->currency] = $totals;
                }
            });
        ksort($summary['totals_by_currency']);

        return $summary;
    }
}
