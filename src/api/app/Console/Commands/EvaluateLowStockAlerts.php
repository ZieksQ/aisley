<?php

namespace App\Console\Commands;

use App\Enums\InventorySkuStatus;
use App\Enums\ProductStatus;
use App\Models\InventoryBalance;
use App\Services\Seller\LowStockAlertService;
use Illuminate\Console\Command;

class EvaluateLowStockAlerts extends Command
{
    protected $signature = 'inventory:evaluate-low-stock-alerts {--chunk=100 : Balances evaluated per chunk}';

    protected $description = 'Evaluate configured inventory thresholds without sending backfill notifications';

    public function handle(LowStockAlertService $alerts): int
    {
        $chunk = max(1, min(1000, (int) $this->option('chunk')));
        $evaluated = 0;

        InventoryBalance::query()
            ->whereNotNull('alert_threshold')
            ->whereHas('sku', fn ($query) => $query
                ->where('status', InventorySkuStatus::Active)
                ->whereHas('product', fn ($products) => $products->where('status', '!=', ProductStatus::Archived)))
            ->orderBy('id')
            ->chunkById($chunk, function ($balances) use ($alerts, &$evaluated): void {
                foreach ($balances as $balance) {
                    $alerts->evaluate($balance->id, notify: false);
                    $evaluated++;
                }
            });

        $this->info("Evaluated {$evaluated} configured inventory balances.");

        return self::SUCCESS;
    }
}
