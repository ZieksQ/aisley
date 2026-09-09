<?php

namespace App\Listeners;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Events\CustomerOrderStatusChanged;
use App\Models\OrderStatusEvent;
use App\Notifications\Customer\OrderStatusChangedNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Ramsey\Uuid\Uuid;
use Throwable;

class SendCustomerOrderStatusNotification implements ShouldQueue
{
    public bool $afterCommit = true;

    public function handle(CustomerOrderStatusChanged $event): void
    {
        try {
            $statusEvent = OrderStatusEvent::query()->with('order.customer')->find($event->orderStatusEventId);
            $order = $statusEvent?->order;
            $customer = $order?->customer;
            if ($statusEvent === null || $order === null || $customer === null || $customer->role !== UserRole::Customer || $customer->status !== UserStatus::Active) {
                return;
            }
            if (! in_array($statusEvent->to_status, OrderStatusChangedNotification::STATUSES, true)) {
                return;
            }
            $id = Uuid::uuid5(Uuid::NAMESPACE_URL, "aisley:customer:{$customer->id}:order-event:{$statusEvent->id}")->toString();
            if ($customer->notifications()->whereKey($id)->exists()) {
                return;
            }
            $notification = new OrderStatusChangedNotification($order, $statusEvent->to_status);
            $notification->id = $id;
            $customer->notify($notification);
        } catch (Throwable $exception) {
            report($exception);
        }
    }
}
