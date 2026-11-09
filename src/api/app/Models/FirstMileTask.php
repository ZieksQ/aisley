<?php

namespace App\Models;

use App\Enums\FirstMileTaskStatus;
use App\Enums\PickupReleaseReason;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FirstMileTask extends Model
{
    use HasUuids;

    protected $fillable = ['pickup_schedule_id', 'order_id', 'waybill_id', 'logistics_organization_id', 'logistics_hub_id', 'courier_id', 'status', 'accepted_at', 'picked_up_at', 'failed_pickup_count', 'released_at', 'release_reason'];

    protected function casts(): array
    {
        return ['status' => FirstMileTaskStatus::class, 'accepted_at' => 'datetime', 'picked_up_at' => 'datetime', 'failed_pickup_count' => 'integer', 'released_at' => 'datetime', 'release_reason' => PickupReleaseReason::class];
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

    public function courier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'courier_id');
    }
}
