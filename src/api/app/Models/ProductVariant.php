<?php

namespace App\Models;

use App\Enums\ProductVariantStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProductVariant extends Model
{
    use HasUuids, SoftDeletes;

    protected $fillable = [
        'product_id',
        'shop_id',
        'sku',
        'price',
        'original_price',
        'stock_quantity',
        'status',
        'primary_media_id',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'original_price' => 'decimal:2',
            'stock_quantity' => 'integer',
            'status' => ProductVariantStatus::class,
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function optionValues(): BelongsToMany
    {
        return $this->belongsToMany(
            ProductOptionValue::class,
            'product_variant_option_values',
            'product_variant_id',
            'product_option_value_id',
        );
    }

    public function media(): HasMany
    {
        return $this->hasMany(ProductMedia::class, 'product_variant_id');
    }

    public function primaryMedia(): BelongsTo
    {
        return $this->belongsTo(ProductMedia::class, 'primary_media_id');
    }

    public function cartItems(): HasMany
    {
        return $this->hasMany(CartItem::class, 'variant_id');
    }

    public function inventorySku(): HasOne
    {
        return $this->hasOne(InventorySku::class, 'product_variant_id');
    }
}
