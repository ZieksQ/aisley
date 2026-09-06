<?php

namespace App\Listeners;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Events\SellerOrderBecameActionable;
use App\Models\Order;
use App\Notifications\Seller\SellerOrderActionableNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Ramsey\Uuid\Uuid;
use Throwable;

class SendSellerOrderActionableNotification implements ShouldQueue
{
    public bool $afterCommit = true;

    public function handle(SellerOrderBecameActionable $event): void
    {
        try {
            $order = Order::query()
                ->with('shop.seller')
                ->find($event->orderId);
            $seller = $order?->shop?->seller;
            if ($seller === null || $seller->role !== UserRole::Seller || $seller->status !== UserStatus::Active) {
                return;
            }

            $notificationId = Uuid::uuid5(
                Uuid::NAMESPACE_URL,
                "aisley:seller:{$seller->id}:order:{$order->id}:actionable",
            )->toString();
            if ($seller->notifications()->whereKey($notificationId)->exists()) {
                return;
            }

            $notification = new SellerOrderActionableNotification($order);
            $notification->id = $notificationId;
            $seller->notify($notification);
        } catch (Throwable $exception) {
            // An in-app delivery problem must never undo the committed Order.
            report($exception);
        }
    }
}
