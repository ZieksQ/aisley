<?php

namespace App\Notifications\Logistics;

use App\Models\SellerPickupRequest;
use Illuminate\Notifications\Notification;

class SellerPickupRequestedNotification extends Notification
{
    public function __construct(private readonly SellerPickupRequest $pickup) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function databaseType(object $notifiable): string
    {
        return 'logistics-pickup.requested';
    }

    public function toDatabase(object $notifiable): array
    {
        return [
            'pickup_request_id' => $this->pickup->id,
            'shop_id' => $this->pickup->shop_id,
            'order_count' => $this->pickup->orders->count(),
            'status' => 'pending_logistics',
        ];
    }
}
