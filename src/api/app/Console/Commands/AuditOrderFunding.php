<?php

namespace App\Console\Commands;

use App\Services\Finance\OrderFundingAuditService;
use Illuminate\Console\Command;
use Illuminate\Support\Str;
use Symfony\Component\Console\Output\OutputInterface;

class AuditOrderFunding extends Command
{
    protected $signature = 'finance:audit-order-funding {--order= : Limit to an Order UUID} {--json : Stream a JSON inventory and summary}';

    protected $description = 'Read-only inventory of frozen Order funding discrepancies; no financial or delivery records are changed.';

    public function handle(OrderFundingAuditService $audit): int
    {
        $orderId = $this->option('order');
        if ($orderId !== null && ! Str::isUuid($orderId)) {
            $this->error('--order must be an Order UUID.');

            return self::INVALID;
        }
        $json = $this->option('json');
        $first = true;
        if ($json) {
            $this->output->write('{"discrepancies":[');
        } else {
            $this->line('Read-only snapshot inventory; positive difference = shortfall, negative = surplus.');
        }
        $summary = $audit->scan(function (array $row) use ($json, &$first): void {
            if ($json) {
                $this->output->write(($first ? '' : ',').json_encode($row, JSON_THROW_ON_ERROR), false, OutputInterface::OUTPUT_RAW);
                $first = false;
            } else {
                $this->line(implode(' | ', [
                    $row['order_id'], $row['snapshot_id'], $row['order_status'], $row['currency'],
                    'funding='.$row['funding_cents'], 'obligations='.$row['obligations_cents'],
                    'difference='.$row['difference_cents'], 'recognized='.($row['recognized'] ? 'yes' : 'no'),
                    $row['classification'],
                ]));
            }
        }, $orderId);
        if ($json) {
            $this->output->writeln('],"summary":'.json_encode($summary, JSON_THROW_ON_ERROR).'}', OutputInterface::OUTPUT_RAW);
        } else {
            $this->line('Scanned '.$summary['scanned_snapshots'].' snapshot(s); '.$summary['discrepancies'].' discrepancy(s).');
            foreach ($summary['totals_by_currency'] as $currency => $totals) {
                $this->line($currency.' '.json_encode($totals, JSON_THROW_ON_ERROR));
            }
        }

        return $summary['discrepancies'] === 0 ? self::SUCCESS : self::FAILURE;
    }
}
