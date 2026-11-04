<?php

namespace App\Listeners;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Events\CustomerOrderStatusChanged;
use App\Models\OrderStatusEvent;
use App\Notifications\OrderDeliveryAddressChangedNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Ramsey\Uuid\Uuid;
use Throwable;

class SendOrderAddressChangeNotifications implements ShouldQueue
{
    public bool $afterCommit = true;

    public function handle(CustomerOrderStatusChanged $event): void
    {
        $record = OrderStatusEvent::with('order.customer', 'order.shop.seller')->find($event->orderStatusEventId);
        if ($record?->source !== 'customer_order_modification'
            || ($record->public_metadata['change_type'] ?? null) !== 'delivery_address') {
            return;
        }
        $order = $record->order;
        foreach ([[$order->customer, UserRole::Customer], [$order->shop->seller, UserRole::Seller]] as [$recipient, $role]) {
            if ($recipient?->role !== $role || $recipient->status !== UserStatus::Active) {
                continue;
            }
            try {
                $id = Uuid::uuid5(Uuid::NAMESPACE_URL, "aisley:order-address:{$record->id}:{$recipient->id}")->toString();
                if ($recipient->notifications()->whereKey($id)->exists()) {
                    continue;
                }
                $notification = new OrderDeliveryAddressChangedNotification($order);
                $notification->id = $id;
                $recipient->notify($notification);
            } catch (Throwable $exception) {
                // Delivery failures never reverse the committed address or block the other recipient.
                report($exception);
            }
        }
    }
}
