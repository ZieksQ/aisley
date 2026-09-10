<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerOrderCancellation extends Model
{
    use HasUuids;

    protected $fillable = [
        'order_id',
        'customer_id',
        'status_event_id',
        'idempotency_key',
        'request_hash',
        'reason',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function statusEvent(): BelongsTo
    {
        return $this->belongsTo(OrderStatusEvent::class, 'status_event_id');
    }
}
