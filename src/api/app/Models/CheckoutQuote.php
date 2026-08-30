<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class CheckoutQuote extends Model
{
    use HasUuids;

    protected $fillable = ['customer_id', 'input_payload', 'request_hash', 'state_hash', 'expires_at'];

    protected function casts(): array
    {
        return ['input_payload' => 'array', 'expires_at' => 'datetime'];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function batch(): HasOne
    {
        return $this->hasOne(CheckoutBatch::class);
    }
}
