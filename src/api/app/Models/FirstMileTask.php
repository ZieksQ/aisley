<?php

namespace App\Models;

use App\Enums\FirstMileTaskStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FirstMileTask extends Model
{
    use HasUuids;

    protected $fillable = ['pickup_schedule_id', 'order_id', 'waybill_id', 'logistics_organization_id', 'logistics_hub_id', 'courier_id', 'status', 'accepted_at'];

    protected function casts(): array
    {
        return ['status' => FirstMileTaskStatus::class, 'accepted_at' => 'datetime'];
    }

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(PickupSchedule::class, 'pickup_schedule_id');
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function waybill(): BelongsTo
    {
        return $this->belongsTo(Waybill::class);
    }
}
