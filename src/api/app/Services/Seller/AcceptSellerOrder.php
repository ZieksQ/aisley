<?php

namespace App\Services\Seller;

use App\Enums\InventoryMovementType;
use App\Enums\InventorySkuStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\ShopStatus;
use App\Exceptions\Seller\SellerOrderException;
use App\Models\InventoryBalance;
use App\Models\InventoryMovement;
use App\Models\InventorySku;
use App\Models\Order;
use App\Models\SellerOrderAcceptance;
use App\Models\Shop;
use App\Models\User;
use App\Services\OrderTransitionService;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;

class AcceptSellerOrder
{
    public function __construct(
        private readonly OrderTransitionService $transitions,
        private readonly SellerOrderService $orders,
    ) {}

    public function handle(User $seller, string $orderId, string $idempotencyKey): Order
    {
        return DB::transaction(function () use ($seller, $orderId, $idempotencyKey): Order {
            $shop = Shop::query()->where('seller_id', $seller->id)->lockForUpdate()->first();
            if ($shop === null) {
                throw (new ModelNotFoundException)->setModel(Shop::class);
            }

            $order = Order::query()
                ->where('shop_id', $shop->id)
                ->whereKey($orderId)
                ->lockForUpdate()
                ->first();
            if ($order === null) {
                throw (new ModelNotFoundException)->setModel(Order::class, [$orderId]);
            }

            $previous = SellerOrderAcceptance::query()
                ->where('seller_id', $seller->id)
                ->where('idempotency_key', $idempotencyKey)
                ->lockForUpdate()
                ->first();
            if ($previous !== null) {
                if ($previous->order_id !== $order->id) {
                    throw SellerOrderException::conflict('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for another Order action.');
                }

                return $this->orders->detail($seller, $order->id);
            }

            $this->assertAcceptable($order, $shop);
            $event = $this->transitions->transition(
                $order,
                OrderStatus::Placed,
                OrderStatus::SellerProcessing,
                'seller_order_acceptance',
            );
            SellerOrderAcceptance::create([
                'order_id' => $order->id,
                'seller_id' => $seller->id,
                'idempotency_key' => $idempotencyKey,
                'status_event_id' => $event->id,
            ]);

            return $this->orders->detail($seller, $order->id);
        }, 3);
    }

    private function assertAcceptable(Order $order, Shop $shop): void
    {
        if ($order->status !== OrderStatus::Placed
            || $order->payment_method !== PaymentMethod::CashOnDelivery
            || $order->payment_status !== PaymentStatus::Pending) {
            throw SellerOrderException::conflict('ORDER_NOT_ACCEPTABLE', 'This Order is no longer eligible to start processing.');
        }
        if ($shop->status !== ShopStatus::Active
            || $order->shop_id !== $shop->id
            || ! $order->customer()->exists()
            || ! $order->address()->exists()
            || ! $order->items()->exists()) {
            throw SellerOrderException::conflict('ORDER_PRECONDITION_FAILED', 'This Order no longer has the required fulfillment snapshots.');
        }

        $items = $order->items()->get(['product_id', 'product_variant_id', 'quantity']);
        $requirements = $items
            ->groupBy(fn ($item) => $item->product_variant_id ?? $item->product_id)
            ->map(fn ($items) => (int) $items->sum('quantity'));
        if ($requirements->has(null)) {
            throw SellerOrderException::conflict('ORDER_PRECONDITION_FAILED', 'This Order has an invalid inventory reference.');
        }

        $skus = InventorySku::query()
            ->where('status', InventorySkuStatus::Active)
            ->whereHas('product', fn ($query) => $query->where('shop_id', $shop->id))
            ->where(function ($query) use ($items): void {
                $variantIds = $items->pluck('product_variant_id')->filter()->values()->all();
                $productIds = $items->filter(fn ($item) => $item->product_variant_id === null)->pluck('product_id')->values()->all();
                if ($variantIds !== []) {
                    $query->whereIn('product_variant_id', $variantIds);
                }
                if ($productIds !== []) {
                    $query->orWhere(fn ($base) => $base->whereIn('product_id', $productIds)->where('is_base', true));
                }
            })
            ->orderBy('id')
            ->lockForUpdate()
            ->get();
        $byTarget = $skus->keyBy(fn (InventorySku $sku) => $sku->product_variant_id ?? $sku->product_id);
        if ($byTarget->count() !== $requirements->count()) {
            throw SellerOrderException::conflict('INVENTORY_RESERVATION_INVALID', 'The reserved inventory for this Order is no longer available.');
        }

        $balances = InventoryBalance::query()
            ->whereIn('inventory_sku_id', $skus->pluck('id'))
            ->orderBy('inventory_sku_id')
            ->lockForUpdate()
            ->get()
            ->keyBy('inventory_sku_id');
        foreach ($requirements as $target => $quantity) {
            $sku = $byTarget->get($target);
            $balance = $sku === null ? null : $balances->get($sku->id);
            if ($balance === null || $balance->reserved < $quantity) {
                throw SellerOrderException::conflict('INVENTORY_RESERVATION_INVALID', 'The reserved inventory for this Order is no longer available.');
            }
        }

        $reservedMovementCount = InventoryMovement::query()
            ->whereIn('inventory_balance_id', $balances->pluck('id'))
            ->where('movement_type', InventoryMovementType::Reserve)
            ->where('reference_type', 'checkout_batch')
            ->where('reference_id', $order->checkout_batch_id)
            ->count();
        if ($reservedMovementCount !== $requirements->count()) {
            throw SellerOrderException::conflict('INVENTORY_RESERVATION_INVALID', 'The reserved inventory for this Order is no longer available.');
        }
    }
}
