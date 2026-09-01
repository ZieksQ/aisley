<?php

namespace App\Models;

use App\Enums\InventorySkuStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class InventorySku extends Model
{
    use HasUuids;

    protected $fillable = [
        'product_id',
        'shop_id',
        'product_variant_id',
        'code',
        'is_base',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'is_base' => 'boolean',
            'status' => InventorySkuStatus::class,
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function balance(): HasOne
    {
        return $this->hasOne(InventoryBalance::class);
    }
}
