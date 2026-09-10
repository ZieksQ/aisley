<?php

namespace App\Services\Customer;

use App\Enums\InventoryMovementType;
use App\Enums\InventorySkuStatus;
use App\Exceptions\Customer\CheckoutException;
use App\Models\InventoryBalance;
use App\Models\InventoryMovement;
use App\Models\InventorySku;
use App\Models\Order;
use App\Models\User;
use App\Services\Seller\LowStockAlertService;
use Illuminate\Support\Collection;

class CustomerOrderInventory
{
    public function __construct(private readonly LowStockAlertService $lowStockAlerts) {}

    /** @return array{Collection, Collection, Collection} */
    public function lockReservation(Order $order): array
    {
        $items = $order->items()->get(['product_id', 'product_variant_id', 'quantity']);
        $requirements = $items
            ->groupBy(fn ($item) => $item->product_variant_id ?? $item->product_id)
            ->map(fn ($lines) => (int) $lines->sum('quantity'));

        if ($requirements->has(null)) {
            throw CheckoutException::conflict(
                'INVENTORY_RESERVATION_INVALID',
                'The reserved inventory for this Order is no longer available.',
            );
        }

        $skus = InventorySku::query()
            ->where('status', InventorySkuStatus::Active)
            ->where('shop_id', $order->shop_id)
            ->where(function ($query) use ($items): void {
                $variants = $items->pluck('product_variant_id')->filter()->all();
                $products = $items->whereNull('product_variant_id')->pluck('product_id')->filter()->all();

                if ($variants !== []) {
                    $query->whereIn('product_variant_id', $variants);
                }
                if ($products !== []) {
                    $query->orWhere(fn ($base) => $base
                        ->whereIn('product_id', $products)
                        ->where('is_base', true));
                }
            })
            ->with(['product', 'variant'])
            ->orderBy('id')
            ->lockForUpdate()
            ->get();

        $byTarget = $skus->keyBy(fn (InventorySku $sku) => $sku->product_variant_id ?? $sku->product_id);
        if ($byTarget->count() !== $requirements->count()) {
            throw CheckoutException::conflict(
                'INVENTORY_RESERVATION_INVALID',
                'The reserved inventory for this Order is no longer available.',
            );
        }

        $balances = InventoryBalance::query()
            ->whereIn('inventory_sku_id', $skus->pluck('id'))
            ->orderBy('inventory_sku_id')
            ->lockForUpdate()
            ->get()
            ->keyBy('inventory_sku_id');
        $reservedByBalance = InventoryMovement::query()
            ->whereIn('inventory_balance_id', $balances->pluck('id'))
            ->where('movement_type', InventoryMovementType::Reserve)
            ->where('reference_type', 'order')
            ->where('reference_id', $order->id)
            ->selectRaw('inventory_balance_id, SUM(reserved_delta) AS quantity')
            ->groupBy('inventory_balance_id')
            ->pluck('quantity', 'inventory_balance_id');

        foreach ($requirements as $target => $quantity) {
            $sku = $byTarget->get($target);
            $balance = $sku === null ? null : $balances->get($sku->id);
            if (
                $balance === null
                || $balance->reserved < $quantity
                || (int) $reservedByBalance->get($balance->id, 0) !== $quantity
            ) {
                throw CheckoutException::conflict(
                    'INVENTORY_RESERVATION_INVALID',
                    'The reserved inventory for this Order is no longer available.',
                );
            }
        }

        return [$requirements, $byTarget, $balances];
    }

    /** @param Collection<string, int> $requirements @param Collection<string, InventorySku> $skus @param Collection<string, InventoryBalance> $balances */
    public function release(
        Order $order,
        User $customer,
        Collection $requirements,
        Collection $skus,
        Collection $balances,
        string $reason,
    ): void {
        foreach ($requirements as $target => $quantity) {
            /** @var InventorySku $sku */
            $sku = $skus->get($target);
            /** @var InventoryBalance $balance */
            $balance = $balances->get($sku->id);
            $idempotencyKey = "customer-cancellation-{$order->id}-{$balance->id}";

            if (InventoryMovement::query()->where('idempotency_key', $idempotencyKey)->exists()) {
                continue;
            }

            $nextReserved = $balance->reserved - $quantity;
            if ($nextReserved < 0) {
                throw CheckoutException::conflict(
                    'INVENTORY_RESERVATION_INVALID',
                    'The reserved inventory for this Order is no longer available.',
                );
            }

            $balance->update(['reserved' => $nextReserved]);
            $movement = InventoryMovement::create([
                'inventory_balance_id' => $balance->id,
                'movement_type' => InventoryMovementType::Release,
                'on_hand_delta' => 0,
                'reserved_delta' => -$quantity,
                'resulting_on_hand' => $balance->on_hand,
                'resulting_reserved' => $nextReserved,
                'reference_type' => 'order',
                'reference_id' => $order->id,
                'idempotency_key' => $idempotencyKey,
                'actor_id' => $customer->id,
                'reason' => $reason,
            ]);

            $product = $sku->product;
            if ($product === null) {
                continue;
            }
            if ($sku->is_base) {
                $product->update(['stock_quantity' => $balance->on_hand - $nextReserved]);
            } elseif ($sku->variant !== null) {
                $sku->variant->update(['stock_quantity' => $balance->on_hand - $nextReserved]);
                $product->update(['stock_quantity' => (int) $product->variants()->sum('stock_quantity')]);
            }

            $this->lowStockAlerts->schedule($balance->id, $movement->id);
        }
    }
}
