<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CheckoutBatch extends Model
{
    use HasUuids;

    protected $fillable = ['customer_id', 'checkout_quote_id', 'idempotency_key', 'request_hash', 'currency', 'placed_at'];

    protected function casts(): array
    {
        return ['placed_at' => 'datetime'];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function quote(): BelongsTo
    {
        return $this->belongsTo(CheckoutQuote::class, 'checkout_quote_id');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }
}
