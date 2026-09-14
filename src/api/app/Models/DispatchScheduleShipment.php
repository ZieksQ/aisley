<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DispatchScheduleShipment extends Model
{
    use HasUuids;

    protected $fillable = ['dispatch_schedule_id', 'shipment_id', 'delivery_task_id', 'sequence'];

    protected function casts(): array
    {
        return ['sequence' => 'integer'];
    }

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(DispatchSchedule::class, 'dispatch_schedule_id');
    }

    public function shipment(): BelongsTo
    {
        return $this->belongsTo(Shipment::class);
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(DeliveryTask::class, 'delivery_task_id');
    }
}
