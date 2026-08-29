<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class ProductOptionValue extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $fillable = [
        'option_group_id',
        'value',
        'swatch_color',
        'swatch_image_path',
        'position',
    ];

    protected function casts(): array
    {
        return ['position' => 'integer'];
    }

    public function optionGroup(): BelongsTo
    {
        return $this->belongsTo(ProductOptionGroup::class, 'option_group_id');
    }

    public function variants(): BelongsToMany
    {
        return $this->belongsToMany(
            ProductVariant::class,
            'product_variant_option_values',
            'product_option_value_id',
            'product_variant_id',
        );
    }
}
