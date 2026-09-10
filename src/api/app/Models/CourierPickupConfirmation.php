<?php

namespace App\Models;

use App\Enums\FirstMileTaskStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class CourierPickupConfirmation extends Model
{
    use HasUuids;

    protected $fillable = [
        'first_mile_task_id',
        'order_id',
        'waybill_id',
        'courier_id',
        'idempotency_key',
        'request_hash',
        'previous_status',
        'new_status',
        'schedule_revision',
        'correlation_id',
        'picked_up_at',
    ];

    protected function casts(): array
    {
        return [
            'previous_status' => FirstMileTaskStatus::class,
            'new_status' => FirstMileTaskStatus::class,
            'schedule_revision' => 'integer',
            'picked_up_at' => 'datetime',
        ];
    }
}
