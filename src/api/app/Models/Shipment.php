<?php

namespace App\Models;

use App\Enums\ShipmentStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Shipment extends Model
{
    use HasUuids;

    protected $fillable = ['condition_hold', 'current_logistics_organization_id', 'current_hub_id', 'parcel_id', 'logistics_organization_id', 'logistics_hub_id', 'status', 'revision', 'sorting_lane_id', 'sorting_session_id', 'received_at_hub_at'];

    protected static function booted(): void
    {
        static::creating(function (Shipment $shipment): void {
            $shipment->current_logistics_organization_id ??= $shipment->logistics_organization_id;
            $shipment->current_hub_id ??= $shipment->logistics_hub_id;
        });
    }

    public function route(): HasOne
    {
        return $this->hasOne(ShipmentRoute::class);
    }

    public function currentHub(): BelongsTo
    {
        return $this->belongsTo(LogisticsHub::class, 'current_hub_id');
    }

    protected function casts(): array
    {
        return ['condition_hold' => 'boolean', 'status' => ShipmentStatus::class, 'revision' => 'integer', 'received_at_hub_at' => 'immutable_datetime'];
    }

    public function sortingLane(): BelongsTo
    {
        return $this->belongsTo(SortingLane::class);
    }

    public function parcel(): BelongsTo
    {
        return $this->belongsTo(Parcel::class);
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(LogisticsOrganization::class, 'logistics_organization_id');
    }

    public function hub(): BelongsTo
    {
        return $this->belongsTo(LogisticsHub::class, 'logistics_hub_id');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(DeliveryTask::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(ShipmentEvent::class);
    }

    public function sortingItems(): HasMany
    {
        return $this->hasMany(SortingSessionItem::class);
    }
}
