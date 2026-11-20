<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class OrderPreparationExtension extends Model
{
    use HasUuids;

    protected $fillable = ['order_id', 'customer_id', 'status_event_id', 'idempotency_key', 'request_hash', 'approved_at', 'deadline_at'];

    protected function casts(): array
    {
        return ['approved_at' => 'immutable_datetime', 'deadline_at' => 'immutable_datetime'];
    }
}
