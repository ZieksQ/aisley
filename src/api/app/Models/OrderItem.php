<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderItem extends Model
{
    use HasUuids;

    protected $fillable = [
        'order_id', 'product_id', 'product_variant_id', 'product_name', 'variant_name',
        'sku', 'selected_options', 'unit_price', 'quantity', 'line_subtotal', 'currency',
    ];

    protected function casts(): array
    {
        return ['selected_options' => 'array', 'unit_price' => 'decimal:2', 'quantity' => 'integer', 'line_subtotal' => 'decimal:2'];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
