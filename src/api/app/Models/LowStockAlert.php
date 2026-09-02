<?php

namespace App\Models;

use App\Enums\Seller\LowStockAlertResolutionReason;
use App\Enums\Seller\LowStockAlertState;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LowStockAlert extends Model
{
    use HasUuids;

    protected $fillable = [
        'seller_id', 'shop_id', 'inventory_sku_id', 'trigger_movement_id',
        'trigger_threshold', 'trigger_available', 'current_threshold', 'current_available',
        'state', 'active_marker', 'resolution_reason', 'triggered_at', 'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'trigger_threshold' => 'integer',
            'trigger_available' => 'integer',
            'current_threshold' => 'integer',
            'current_available' => 'integer',
            'state' => LowStockAlertState::class,
            'resolution_reason' => LowStockAlertResolutionReason::class,
            'triggered_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function sku(): BelongsTo
    {
        return $this->belongsTo(InventorySku::class, 'inventory_sku_id');
    }

    public function triggerMovement(): BelongsTo
    {
        return $this->belongsTo(InventoryMovement::class, 'trigger_movement_id');
    }
}
