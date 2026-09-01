<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductUpload extends Model
{
    use HasUuids;

    protected $fillable = [
        'id', 'shop_id', 'seller_id', 'upload_token', 'purpose', 'disk', 'path', 'mime_type',
        'byte_size', 'width', 'height', 'checksum', 'scan_status', 'alt_text', 'expires_at',
    ];

    protected function casts(): array
    {
        return ['byte_size' => 'integer', 'width' => 'integer', 'height' => 'integer', 'expires_at' => 'datetime'];
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }
}
