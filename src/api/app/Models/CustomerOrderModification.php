<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerOrderModification extends Model
{
    use HasUuids;

    protected $fillable = [
        'order_id',
        'customer_id',
        'status_event_id',
        'previous_address_id',
        'new_address_id',
        'change_type',
        'idempotency_key',
        'request_hash',
        'expected_revision',
    ];

    protected function casts(): array
    {
        return ['expected_revision' => 'integer'];
    }

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

    public function previousAddress(): BelongsTo
    {
        return $this->belongsTo(OrderAddress::class, 'previous_address_id');
    }

    public function newAddress(): BelongsTo
    {
        return $this->belongsTo(OrderAddress::class, 'new_address_id');
    }
}
