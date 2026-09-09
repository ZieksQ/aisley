<?php

namespace App\Notifications\Customer;

use App\Enums\OrderStatus;
use App\Models\Order;
use Illuminate\Notifications\Notification;

class OrderStatusChangedNotification extends Notification
{
    public const STATUSES = [
        OrderStatus::SellerProcessing,
        OrderStatus::Cancelled,
        OrderStatus::Rejected,
        OrderStatus::OutForDelivery,
        OrderStatus::Delivered,
        OrderStatus::DeliveryFailed,
        OrderStatus::ReturnRequested,
        OrderStatus::Returned,
    ];

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
        [$title, $summary] = match ($this->status) {
            OrderStatus::SellerProcessing => ['Order approved by seller', "The seller approved order {$this->order->reference} and is preparing it."],
            OrderStatus::Cancelled => ['Order cancelled', "Order {$this->order->reference} was cancelled."],
            OrderStatus::Rejected => ['Order could not be fulfilled', "The seller could not fulfill order {$this->order->reference}."],
            OrderStatus::OutForDelivery => ['Order out for delivery', "Order {$this->order->reference} is out for delivery."],
            OrderStatus::Delivered => ['Order delivered', "Order {$this->order->reference} was delivered."],
            OrderStatus::DeliveryFailed => ['Delivery issue', "A delivery attempt for order {$this->order->reference} was not completed."],
            OrderStatus::ReturnRequested => ['Return requested', "A return was requested for order {$this->order->reference}."],
            OrderStatus::Returned => ['Order returned', "Order {$this->order->reference} was returned."],
            default => ['Order update', "There is an update for order {$this->order->reference}."],
        };

        return [
            'title' => $title,
            'summary' => $summary,
            'order_id' => $this->order->id,
            'order_reference' => $this->order->reference,
            'status' => $this->status->value,
        ];
    }
}
