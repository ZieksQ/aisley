<?php

namespace App\Models;

use App\Enums\Seller\ReviewResponseStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SellerReviewResponse extends Model
{
    use HasUuids;

    protected $fillable = [
        'review_id',
        'seller_id',
        'shop_id',
        'shop_name_snapshot',
        'body',
        'status',
        'idempotency_key',
        'request_hash',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => ReviewResponseStatus::class,
            'published_at' => 'datetime',
        ];
    }

    public function scopePublished(Builder $query): Builder
    {
        return $query
            ->where('status', ReviewResponseStatus::Published)
            ->where('published_at', '<=', now());
    }

    public function review(): BelongsTo
    {
        return $this->belongsTo(ProductReview::class, 'review_id');
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }
}
