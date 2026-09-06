<?php

namespace App\Services\Seller;

use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\ShopStatus;
use App\Exceptions\Seller\SellerOrderException;
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
        private readonly SellerOrderInventory $inventory,
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

        $this->inventory->lockReservation($order, $shop);
    }
}
