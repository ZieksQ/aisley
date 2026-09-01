<?php

namespace App\Services\Seller;

use App\Enums\InventoryMovementType;
use App\Enums\InventorySkuStatus;
use App\Models\InventoryBalance;
use App\Models\InventoryMovement;
use App\Models\InventorySku;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InventoryService
{
    public function createBaseSku(Product $product, string $code, int $openingStock, User $actor): InventorySku
    {
        $sku = $product->inventorySkus()->create([
            'shop_id' => $product->shop_id,
            'code' => $code,
            'is_base' => true,
            'status' => InventorySkuStatus::Active,
        ]);
        $balance = $sku->balance()->create(['on_hand' => 0, 'reserved' => 0]);

        if ($openingStock > 0) {
            $this->adjust($sku, $openingStock, InventoryMovementType::Restock, 'Opening stock', $actor);
        }

        return $sku->load('balance');
    }

    public function createVariantSku(Product $product, ProductVariant $variant, string $code, User $actor): InventorySku
    {
        $sku = $product->inventorySkus()->create([
            'shop_id' => $product->shop_id,
            'product_variant_id' => $variant->id,
            'code' => $code,
            'is_base' => false,
            'status' => InventorySkuStatus::Active,
        ]);
        $sku->balance()->create(['on_hand' => 0, 'reserved' => 0]);

        return $sku->load('balance');
    }

    public function adjust(InventorySku $sku, int $quantity, InventoryMovementType $type, string $reason, User $actor, ?string $idempotencyKey = null): InventoryMovement
    {
        return DB::transaction(function () use ($sku, $quantity, $type, $reason, $actor, $idempotencyKey): InventoryMovement {
            if ($sku->status !== InventorySkuStatus::Active) {
                throw ValidationException::withMessages(['inventory' => 'Archived or inactive inventory cannot be adjusted.']);
            }

            if ($idempotencyKey) {
                $existing = InventoryMovement::where('idempotency_key', $idempotencyKey)->first();
                if ($existing) {
                    if ($existing->inventory_balance_id !== $sku->balance()->value('id')) {
                        throw ValidationException::withMessages(['idempotency_key' => 'This idempotency key was already used for different inventory.']);
                    }

                    return $existing;
                }
            }

            $balance = InventoryBalance::where('inventory_sku_id', $sku->id)->lockForUpdate()->firstOrFail();
            $delta = match ($type) {
                InventoryMovementType::Restock, InventoryMovementType::ManualIncrease, InventoryMovementType::ReturnIn => $quantity,
                InventoryMovementType::ManualDecrease => -$quantity,
                default => throw ValidationException::withMessages(['movement_type' => 'This movement type cannot be entered manually.']),
            };
            $nextOnHand = $balance->on_hand + $delta;

            if ($nextOnHand < $balance->reserved) {
                throw ValidationException::withMessages(['quantity' => 'The adjustment would reduce stock below the reserved quantity.']);
            }

            $balance->update(['on_hand' => $nextOnHand]);
            $this->syncLegacyQuantity($sku, $nextOnHand - $balance->reserved);

            return $balance->movements()->create([
                'movement_type' => $type,
                'on_hand_delta' => $delta,
                'reserved_delta' => 0,
                'resulting_on_hand' => $nextOnHand,
                'resulting_reserved' => $balance->reserved,
                'idempotency_key' => $idempotencyKey,
                'actor_id' => $actor->id,
                'reason' => $reason,
            ]);
        });
    }

    private function syncLegacyQuantity(InventorySku $sku, int $available): void
    {
        if ($sku->is_base) {
            $sku->product()->update(['stock_quantity' => $available]);

            return;
        }

        $sku->variant()->update(['stock_quantity' => $available]);
        $sku->product()->update([
            'stock_quantity' => (int) $sku->product->variants()->sum('stock_quantity'),
        ]);
    }
}
