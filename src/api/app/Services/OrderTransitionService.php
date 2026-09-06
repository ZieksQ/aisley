<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Exceptions\Seller\SellerOrderException;
use App\Models\Order;
use App\Models\OrderStatusEvent;

class OrderTransitionService
{
    public function transition(Order $order, OrderStatus $from, OrderStatus $to, string $source): OrderStatusEvent
    {
        if ($order->status !== $from) {
            throw SellerOrderException::conflict('ORDER_TRANSITION_CONFLICT', 'This Order is no longer available for that action.');
        }

        $order->update(['status' => $to]);

        return $order->statusEvents()->create([
            'from_status' => $from,
            'to_status' => $to,
            'source' => $source,
            'occurred_at' => now(),
        ]);
    }
}
