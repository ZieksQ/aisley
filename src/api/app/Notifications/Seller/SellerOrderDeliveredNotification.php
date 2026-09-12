<?php

namespace App\Notifications\Seller;

use App\Models\Order;
use Illuminate\Notifications\Notification;

class SellerOrderDeliveredNotification extends Notification
{
    public function __construct(private readonly Order $order) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function databaseType(object $notifiable): string
    {
        return 'seller-order.delivered';
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'title' => 'Order delivered',
            'summary' => "Order {$this->order->reference} was delivered to the Customer.",
            'order_id' => $this->order->id,
            'order_reference' => $this->order->reference,
            'status' => 'delivered',
            'resource_type' => 'order',
            'resource_id' => $this->order->id,
            'destination' => "/orders/{$this->order->id}",
        ];
    }
}
