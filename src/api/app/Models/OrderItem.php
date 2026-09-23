<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class OrderItem extends Model
{
    use HasUuids;

    protected $fillable = [
        'order_id', 'product_id', 'product_variant_id', 'product_name', 'variant_name',
        'sku', 'selected_options', 'unit_price', 'quantity', 'line_subtotal', 'currency',
        'unit_cost_cents', 'cost_currency',
    ];

    protected function casts(): array
    {
        return ['selected_options' => 'array', 'unit_price' => 'decimal:2', 'quantity' => 'integer', 'line_subtotal' => 'decimal:2', 'unit_cost_cents' => 'integer'];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function review(): HasOne
    {
        return $this->hasOne(ProductReview::class, 'order_item_id');
    }
}
