<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SellerOrderAcceptance extends Model
{
    use HasUuids;

    protected $fillable = ['order_id', 'seller_id', 'idempotency_key', 'status_event_id'];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function statusEvent(): BelongsTo
    {
        return $this->belongsTo(OrderStatusEvent::class, 'status_event_id');
    }
}
