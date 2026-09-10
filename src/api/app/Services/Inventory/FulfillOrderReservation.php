<?php

namespace App\Services\Inventory;

use App\Enums\InventoryMovementType;
use App\Exceptions\Courier\CourierPickupException;
use App\Models\InventoryBalance;
use App\Models\InventoryMovement;
use App\Models\InventorySku;
use App\Models\Order;
use App\Models\User;

class FulfillOrderReservation
{
    public function handle(Order $order, User $actor, string $taskId): void
    {
        $items = $order->items()->get(['product_id', 'product_variant_id', 'quantity']);
        $requirements = $items->groupBy(fn ($item) => $item->product_variant_id ?? $item->product_id)
            ->map(fn ($lines) => (int) $lines->sum('quantity'));
        if ($requirements->has(null)) {
            throw CourierPickupException::conflict('INVENTORY_RESERVATION_INVALID', 'The Order inventory reservation is unavailable.');
        }

        $skus = InventorySku::query()
            ->where('shop_id', $order->shop_id)
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
        $balances = InventoryBalance::query()->whereIn('inventory_sku_id', $skus->pluck('id'))
            ->orderBy('inventory_sku_id')->lockForUpdate()->get()->keyBy('inventory_sku_id');

        foreach ($requirements as $target => $quantity) {
            $sku = $byTarget->get($target);
            $balance = $sku ? $balances->get($sku->id) : null;
            if ($balance === null || $balance->reserved < $quantity || $balance->on_hand < $quantity) {
                throw CourierPickupException::conflict('INVENTORY_RESERVATION_INVALID', 'The Order inventory reservation is unavailable.');
            }

            $nextOnHand = $balance->on_hand - $quantity;
            $nextReserved = $balance->reserved - $quantity;
            $balance->update(['on_hand' => $nextOnHand, 'reserved' => $nextReserved]);
            InventoryMovement::create([
                'inventory_balance_id' => $balance->id,
                'movement_type' => InventoryMovementType::Fulfillment,
                'on_hand_delta' => -$quantity,
                'reserved_delta' => -$quantity,
                'resulting_on_hand' => $nextOnHand,
                'resulting_reserved' => $nextReserved,
                'reference_type' => 'order',
                'reference_id' => $order->id,
                'idempotency_key' => "courier-pickup-{$taskId}-{$balance->id}",
                'actor_id' => $actor->id,
                'reason' => 'Fulfilled when the Courier confirmed physical pickup from the Seller.',
            ]);

            if ($sku->is_base) {
                $sku->product()->update(['stock_quantity' => $nextOnHand - $nextReserved]);
            } else {
                $sku->variant()->update(['stock_quantity' => $nextOnHand - $nextReserved]);
                $sku->product()->update(['stock_quantity' => (int) $sku->product->variants()->sum('stock_quantity')]);
            }
        }
    }
}
