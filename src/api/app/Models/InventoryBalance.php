<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryBalance extends Model
{
    use HasUuids;

    protected $fillable = [
        'inventory_sku_id',
        'on_hand',
        'reserved',
        'alert_threshold',
    ];

    protected function casts(): array
    {
        return [
            'on_hand' => 'integer',
            'reserved' => 'integer',
            'alert_threshold' => 'integer',
        ];
    }

    public function sku(): BelongsTo
    {
        return $this->belongsTo(InventorySku::class, 'inventory_sku_id');
    }

    public function movements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class)->latest('created_at');
    }

    public function available(): int
    {
        return $this->on_hand - $this->reserved;
    }
}
