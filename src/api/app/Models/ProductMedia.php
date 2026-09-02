<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProductMedia extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'product_media';

    protected $fillable = [
        'id',
        'product_id',
        'product_variant_id',
        'disk',
        'path',
        'alt_text',
        'position',
        'is_default',
        'mime_type',
        'byte_size',
        'width',
        'height',
        'checksum',
        'scan_status',
        'purge_after',
    ];

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'is_default' => 'boolean',
            'byte_size' => 'integer',
            'width' => 'integer',
            'height' => 'integer',
            'purge_after' => 'datetime',
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
}
