<?php

namespace App\Services\Seller;

use App\Enums\InventorySkuStatus;
use App\Enums\ProductStatus;
use App\Enums\Seller\LowStockAlertResolutionReason;
use App\Enums\Seller\LowStockAlertState;
use App\Models\InventoryBalance;
use App\Models\LowStockAlert;
use App\Notifications\Seller\LowStockAlertNotification;
use Illuminate\Support\Facades\DB;
use Throwable;

class LowStockAlertService
{
    public function schedule(string $balanceId, ?string $movementId = null, bool $notify = true): void
    {
        DB::afterCommit(function () use ($balanceId, $movementId, $notify): void {
            try {
                $this->evaluate($balanceId, $movementId, $notify);
            } catch (Throwable $exception) {
                report($exception);
            }
        });
    }

    public function evaluate(string $balanceId, ?string $movementId = null, bool $notify = true): ?LowStockAlert
    {
        $created = false;

        $alert = DB::transaction(function () use ($balanceId, $movementId, &$created): ?LowStockAlert {
            $balance = InventoryBalance::query()
                ->with(['sku.product.shop.seller'])
                ->lockForUpdate()
                ->findOrFail($balanceId);
            $sku = $balance->sku;
            $active = LowStockAlert::query()
                ->where('inventory_sku_id', $sku->id)
                ->where('active_marker', 'active')
                ->lockForUpdate()
                ->first();
            $available = $balance->available();

            if ($balance->alert_threshold === null) {
                if ($active !== null) {
                    $active->update([
                        'state' => LowStockAlertState::Resolved,
                        'active_marker' => null,
                        'resolution_reason' => LowStockAlertResolutionReason::ThresholdDisabled,
                        'current_available' => $available,
                        'resolved_at' => now(),
                    ]);
                }

                return $active;
            }

            $threshold = $balance->alert_threshold;
            if ($available > $threshold) {
                if ($active !== null) {
                    $active->update([
                        'state' => LowStockAlertState::Resolved,
                        'active_marker' => null,
                        'resolution_reason' => LowStockAlertResolutionReason::StockRecovered,
                        'current_threshold' => $threshold,
                        'current_available' => $available,
                        'resolved_at' => now(),
                    ]);
                }

                return $active;
            }

            if ($active !== null) {
                $active->update(['current_threshold' => $threshold, 'current_available' => $available]);

                return $active;
            }

            if ($sku->status !== InventorySkuStatus::Active || $sku->product->status === ProductStatus::Archived) {
                return null;
            }

            $created = true;

            return LowStockAlert::create([
                'seller_id' => $sku->product->shop->seller_id,
                'shop_id' => $sku->shop_id,
                'inventory_sku_id' => $sku->id,
                'trigger_movement_id' => $movementId,
                'trigger_threshold' => $threshold,
                'trigger_available' => $available,
                'current_threshold' => $threshold,
                'current_available' => $available,
                'state' => LowStockAlertState::Active,
                'active_marker' => 'active',
                'triggered_at' => now(),
            ]);
        }, 3);

        if ($created && $notify && $alert !== null) {
            try {
                $alert->seller->notify(new LowStockAlertNotification($alert));
            } catch (Throwable $exception) {
                report($exception);
            }
        }

        return $alert;
    }
}
