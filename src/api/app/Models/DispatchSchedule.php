<?php

namespace App\Models;

use App\Enums\DispatchScheduleStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DispatchSchedule extends Model
{
    use HasUuids;

    protected $fillable = [
        'logistics_organization_id', 'logistics_hub_id', 'courier_id', 'created_by_logistics_id',
        'reference', 'scheduled_for', 'status', 'parcel_count', 'revision', 'idempotency_key', 'request_hash',
    ];

    protected function casts(): array
    {
        return ['scheduled_for' => 'datetime', 'status' => DispatchScheduleStatus::class, 'parcel_count' => 'integer', 'revision' => 'integer'];
    }

    public function courier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'courier_id');
    }

    public function shipments(): HasMany
    {
        return $this->hasMany(DispatchScheduleShipment::class);
    }
}
