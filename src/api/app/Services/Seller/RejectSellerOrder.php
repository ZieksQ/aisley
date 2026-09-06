<?php

namespace App\Services\Seller;

use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\ShopStatus;
use App\Exceptions\Seller\SellerOrderException;
use App\Models\Order;
use App\Models\SellerOrderRejection;
use App\Models\Shop;
use App\Models\User;
use App\Services\OrderTransitionService;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;

class RejectSellerOrder
{
    public function __construct(
        private readonly OrderTransitionService $transitions,
        private readonly SellerOrderService $orders,
        private readonly SellerOrderInventory $inventory,
    ) {}

    public function handle(User $seller, string $orderId, string $key, ?string $reason): Order
    {
        return DB::transaction(function () use ($seller, $orderId, $key, $reason): Order {
            $shop = Shop::query()->where('seller_id', $seller->id)->lockForUpdate()->first();
            $order = $shop ? Order::query()->where('shop_id', $shop->id)->whereKey($orderId)->lockForUpdate()->first() : null;
            if (! $shop || ! $order) {
                throw (new ModelNotFoundException)->setModel(Order::class, [$orderId]);
            }

            $previous = SellerOrderRejection::query()->where('seller_id', $seller->id)->where('idempotency_key', $key)->first();
            if ($previous) {
                if ($previous->order_id !== $order->id) {
                    throw SellerOrderException::conflict('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for another Order action.');
                }

                return $this->orders->detail($seller, $order->id);
            }
            if ($order->status !== OrderStatus::Placed || $order->payment_method !== PaymentMethod::CashOnDelivery || $order->payment_status !== PaymentStatus::Pending) {
                throw SellerOrderException::conflict('ORDER_NOT_REJECTABLE', 'This Order is no longer available for rejection.');
            }
            if ($shop->status !== ShopStatus::Active) {
                throw SellerOrderException::conflict('ORDER_NOT_REJECTABLE', 'This Shop is not available for Order decisions.');
            }
            [$requirements, $skus, $balances] = $this->inventory->lockReservation($order, $shop);
            $event = $this->transitions->transition($order, OrderStatus::Placed, OrderStatus::Rejected, 'seller_order_rejection');
            $this->inventory->release($order, $requirements, $skus, $balances, 'Released after Seller rejected the Order.');
            SellerOrderRejection::create(['order_id' => $order->id, 'seller_id' => $seller->id, 'idempotency_key' => $key, 'status_event_id' => $event->id, 'reason' => $reason]);

            return $this->orders->detail($seller, $order->id);
        }, 3);
    }
}
