<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProductDescriptionAsset extends Model
{
    use HasUuids, SoftDeletes;

    protected $fillable = [
        'id', 'shop_id', 'product_id', 'disk', 'path', 'mime_type', 'byte_size', 'width', 'height',
        'checksum', 'scan_status', 'referenced_at', 'purge_after',
    ];

    protected function casts(): array
    {
        return [
            'byte_size' => 'integer', 'width' => 'integer', 'height' => 'integer',
            'referenced_at' => 'datetime', 'purge_after' => 'datetime',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
