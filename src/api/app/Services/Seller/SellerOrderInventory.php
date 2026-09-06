<?php

namespace App\Services\Seller;

use App\Enums\InventoryMovementType;
use App\Enums\InventorySkuStatus;
use App\Exceptions\Seller\SellerOrderException;
use App\Models\InventoryBalance;
use App\Models\InventoryMovement;
use App\Models\InventorySku;
use App\Models\Order;
use App\Models\Shop;
use Illuminate\Support\Collection;

class SellerOrderInventory
{
    public function __construct(private readonly LowStockAlertService $lowStockAlerts) {}

    /** @return array{Collection, Collection, Collection} requirements, SKUs, balances */
    public function lockReservation(Order $order, Shop $shop): array
    {
        $items = $order->items()->get(['product_id', 'product_variant_id', 'quantity']);
        $requirements = $items->groupBy(fn ($item) => $item->product_variant_id ?? $item->product_id)
            ->map(fn ($lines) => (int) $lines->sum('quantity'));
        if ($requirements->has(null)) {
            throw SellerOrderException::conflict('ORDER_PRECONDITION_FAILED', 'This Order has an invalid inventory reference.');
        }

        $skus = InventorySku::query()
            ->where('status', InventorySkuStatus::Active)
            ->where('shop_id', $shop->id)
            ->where(function ($query) use ($items): void {
                $variants = $items->pluck('product_variant_id')->filter()->all();
                $products = $items->whereNull('product_variant_id')->pluck('product_id')->filter()->all();
                if ($variants !== []) {
                    $query->whereIn('product_variant_id', $variants);
                }
                if ($products !== []) {
                    $query->orWhere(fn ($base) => $base->whereIn('product_id', $products)->where('is_base', true));
                }
            })->orderBy('id')->lockForUpdate()->get();
        $byTarget = $skus->keyBy(fn (InventorySku $sku) => $sku->product_variant_id ?? $sku->product_id);
        if ($byTarget->count() !== $requirements->count()) {
            throw SellerOrderException::conflict('INVENTORY_RESERVATION_INVALID', 'The reserved inventory for this Order is no longer available.');
        }

        $balances = InventoryBalance::query()->whereIn('inventory_sku_id', $skus->pluck('id'))
            ->orderBy('inventory_sku_id')->lockForUpdate()->get()->keyBy('inventory_sku_id');
        $reservedByBalance = InventoryMovement::query()
            ->whereIn('inventory_balance_id', $balances->pluck('id'))
            ->where('movement_type', InventoryMovementType::Reserve)
            ->where('reference_type', 'order')->where('reference_id', $order->id)
            ->selectRaw('inventory_balance_id, SUM(reserved_delta) AS quantity')
            ->groupBy('inventory_balance_id')->pluck('quantity', 'inventory_balance_id');

        foreach ($requirements as $target => $quantity) {
            $sku = $byTarget->get($target);
            $balance = $sku ? $balances->get($sku->id) : null;
            if (! $balance || $balance->reserved < $quantity || (int) $reservedByBalance->get($balance->id, 0) !== $quantity) {
                throw SellerOrderException::conflict('INVENTORY_RESERVATION_INVALID', 'The reserved inventory for this Order is no longer available.');
            }
        }

        return [$requirements, $byTarget, $balances];
    }

    public function release(Order $order, Collection $requirements, Collection $skus, Collection $balances, string $reason): void
    {
        foreach ($requirements as $target => $quantity) {
            $balance = $balances->get($skus->get($target)->id);
            $next = $balance->reserved - $quantity;
            $balance->update(['reserved' => $next]);
            $movement = InventoryMovement::create([
                'inventory_balance_id' => $balance->id,
                'movement_type' => InventoryMovementType::Release,
                'reserved_delta' => -$quantity,
                'resulting_on_hand' => $balance->on_hand,
                'resulting_reserved' => $next,
                'reference_type' => 'order',
                'reference_id' => $order->id,
                'idempotency_key' => "seller-rejection-{$order->id}-{$balance->id}",
                'reason' => $reason,
            ]);
            if ($skus->get($target)->is_base) {
                $skus->get($target)->product()->update(['stock_quantity' => $balance->on_hand - $next]);
            } else {
                $sku = $skus->get($target);
                $sku->variant()->update(['stock_quantity' => $balance->on_hand - $next]);
                $sku->product()->update(['stock_quantity' => (int) $sku->product->variants()->sum('stock_quantity')]);
            }
            $this->lowStockAlerts->schedule($balance->id, $movement->id);
        }
    }
}
