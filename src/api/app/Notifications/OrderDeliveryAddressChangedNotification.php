<?php

namespace App\Notifications;

use App\Enums\UserRole;
use App\Models\Order;
use Illuminate\Notifications\Notification;

class OrderDeliveryAddressChangedNotification extends Notification
{
    public function __construct(private readonly Order $order) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function databaseType(object $notifiable): string
    {
        return ($notifiable->role === UserRole::Seller ? 'seller' : 'customer').'-order.address-changed';
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'title' => 'Order delivery address changed',
            'summary' => "The delivery details for order {$this->order->reference} were updated before seller approval. Open the order to review the current address and total.",
            'order_id' => $this->order->id,
            'order_reference' => $this->order->reference,
            'resource_type' => 'order', 'resource_id' => $this->order->id,
            'destination' => "/orders/{$this->order->id}",
        ];
    }
}
