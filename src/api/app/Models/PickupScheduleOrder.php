<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PickupScheduleOrder extends Model
{
    use HasUuids;

    protected $fillable = ['pickup_schedule_id', 'seller_pickup_request_id', 'order_id'];

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(PickupSchedule::class, 'pickup_schedule_id');
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }
}
