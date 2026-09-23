<?php

namespace App\Models;

use App\Enums\Logistics\LinehaulTripDirection;
use App\Enums\Logistics\LinehaulTripStatus;
use App\Enums\Logistics\UnloadingOutcome;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class LinehaulTrip extends Model
{
    use HasUuids;

    protected $fillable = [
        'owner_logistics_organization_id', 'home_hub_id', 'from_hub_id', 'to_hub_id',
        'company_truck_id', 'driver_id', 'parent_trip_id', 'linehaul_manifest_id',
        'requested_by', 'decided_by', 'direction', 'status', 'scheduled_for',
        'capacity_snapshot', 'parcel_count', 'rejection_reason', 'decided_at',
        'arrived_at', 'arrived_by', 'unloading_closed_at', 'unloading_closed_by', 'unloading_outcome',
        'departed_at', 'received_at', 'revision', 'idempotency_key', 'request_hash',
    ];

    protected function casts(): array
    {
        return [
            'arrived_at' => 'immutable_datetime',
            'unloading_closed_at' => 'immutable_datetime',
            'unloading_outcome' => UnloadingOutcome::class,
            'direction' => LinehaulTripDirection::class,
            'status' => LinehaulTripStatus::class,
            'scheduled_for' => 'datetime',
            'decided_at' => 'datetime',
            'departed_at' => 'datetime',
            'received_at' => 'datetime',
            'capacity_snapshot' => 'integer',
            'parcel_count' => 'integer',
            'revision' => 'integer',
        ];
    }

    public function truck(): BelongsTo
    {
        return $this->belongsTo(CompanyTruck::class, 'company_truck_id');
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'driver_id');
    }

    public function fromHub(): BelongsTo
    {
        return $this->belongsTo(LogisticsHub::class, 'from_hub_id');
    }

    public function toHub(): BelongsTo
    {
        return $this->belongsTo(LogisticsHub::class, 'to_hub_id');
    }

    public function shipments(): HasMany
    {
        return $this->hasMany(LinehaulTripShipment::class);
    }

    public function returnTrip(): HasOne
    {
        return $this->hasOne(self::class, 'parent_trip_id');
    }
}
