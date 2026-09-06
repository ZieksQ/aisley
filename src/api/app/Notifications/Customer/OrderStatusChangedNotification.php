<?php

namespace App\Notifications\Customer;

use App\Enums\OrderStatus;
use App\Models\Order;
use Illuminate\Notifications\Notification;

class OrderStatusChangedNotification extends Notification
{
    public function __construct(private readonly Order $order, private readonly OrderStatus $status) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function databaseType(object $notifiable): string
    {
        return 'customer-order.status-changed';
    }

    public function toDatabase(object $notifiable): array
    {
        $label = str($this->status->value)->replace('_', ' ')->title()->toString();

        return [
            'title' => "Order {$label}",
            'summary' => "Your order {$this->order->reference} is now {$label}.",
            'order_id' => $this->order->id,
            'order_reference' => $this->order->reference,
            'status' => $this->status->value,
        ];
    }
}
