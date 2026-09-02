<?php

namespace App\Notifications\Seller;

use App\Models\LowStockAlert;
use Illuminate\Notifications\Notification;

class LowStockAlertNotification extends Notification
{
    public function __construct(private readonly LowStockAlert $alert) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function databaseType(object $notifiable): string
    {
        return 'inventory.low-stock';
    }

    public function toDatabase(object $notifiable): array
    {
        $this->alert->loadMissing('sku.product:id,name');

        return [
            'title' => 'Low stock: '.$this->alert->sku->product->name,
            'summary' => "{$this->alert->current_available} available for SKU {$this->alert->sku->code}; threshold {$this->alert->current_threshold}.",
            'resource_type' => 'low_stock_alert',
            'resource_id' => $this->alert->id,
            'inventory_sku_id' => $this->alert->inventory_sku_id,
            'destination' => "/low-stock-alerts/{$this->alert->id}",
        ];
    }
}
