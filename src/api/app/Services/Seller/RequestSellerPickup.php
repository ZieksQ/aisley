<?php

namespace App\Services\Seller;

use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Exceptions\Seller\SellerOrderException;
use App\Models\Order;
use App\Models\SellerPickupRequest;
use App\Models\Shop;
use App\Models\User;
use App\Notifications\Logistics\SellerPickupRequestedNotification;
use App\Services\OrderTransitionService;
use Illuminate\Support\Facades\DB;

class RequestSellerPickup
{
    public function __construct(
        private readonly OrderTransitionService $transitions,
        private readonly SellerOrderInventory $inventory,
    ) {}

    public function handle(User $seller, array $orderIds, string $key): SellerPickupRequest
    {
        return DB::transaction(function () use ($seller, $orderIds, $key): SellerPickupRequest {
            $shop = Shop::query()->where('seller_id', $seller->id)->lockForUpdate()->firstOrFail();
            $previous = SellerPickupRequest::query()->where('seller_id', $seller->id)->where('idempotency_key', $key)->with('orders')->first();
            if ($previous) {
                $committed = $previous->orders->pluck('order_id')->sort()->values()->all();
                $requested = collect($orderIds)->sort()->values()->all();
                if ($committed !== $requested) {
                    throw SellerOrderException::conflict('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for another pickup request.');
                }

                return $previous;
            }

            $orders = Order::query()->where('shop_id', $shop->id)->whereIn('id', $orderIds)->orderBy('id')->lockForUpdate()->get();
            if ($orders->count() !== count($orderIds)) {
                throw SellerOrderException::conflict('PICKUP_ORDERS_INVALID', 'One or more selected Orders are unavailable.');
            }
            if ($orders->contains(fn (Order $order) => $order->status !== OrderStatus::SellerProcessing)) {
                throw SellerOrderException::conflict('PICKUP_ORDERS_INVALID', 'Only processing Orders can be submitted for pickup.');
            }
            if ($shop->status !== ShopStatus::Active || $orders->contains(fn (Order $order) => $order->payment_method !== PaymentMethod::CashOnDelivery
                || $order->payment_status !== PaymentStatus::Pending || ! $order->items()->exists() || ! $order->address()->exists())) {
                throw SellerOrderException::conflict('PICKUP_ORDERS_INVALID', 'One or more selected Orders no longer meet the pickup requirements.');
            }
            foreach ($orders as $order) {
                $this->inventory->lockReservation($order, $shop);
            }

            $request = SellerPickupRequest::create(['shop_id' => $shop->id, 'seller_id' => $seller->id, 'status' => 'pending_logistics', 'idempotency_key' => $key]);
            foreach ($orders as $order) {
                $event = $this->transitions->transition($order, OrderStatus::SellerProcessing, OrderStatus::ReadyForPickup, 'seller_pickup_request');
                $request->orders()->create(['order_id' => $order->id, 'status_event_id' => $event->id]);
            }

            DB::afterCommit(function () use ($request): void {
                try {
                    User::query()->where('role', UserRole::Logistics)->where('status', UserStatus::Active)
                        ->whereHas('logisticsOrganization')->eachById(fn (User $user) => $user->notify(new SellerPickupRequestedNotification($request->loadMissing('orders'))));
                } catch (\Throwable $exception) {
                    report($exception);
                }
            });

            return $request->load('orders');
        }, 3);
    }
}
