<?php

namespace App\Models;

use App\Enums\Logistics\HubRouteStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ShipmentRoute extends Model
{
    use HasUuids;

    protected $fillable = ['waybill_id', 'shipment_id', 'origin_hub_id', 'destination_hub_id', 'status', 'algorithm', 'objective', 'graph_revision', 'distance_meters', 'duration_seconds', 'failure_code', 'calculated_at'];

    protected function casts(): array
    {
        return ['status' => HubRouteStatus::class, 'distance_meters' => 'float', 'duration_seconds' => 'float', 'calculated_at' => 'immutable_datetime'];
    }

    public function hops(): HasMany
    {
        return $this->hasMany(ShipmentRouteHop::class)->orderBy('sequence');
    }

    public function originHub(): BelongsTo
    {
        return $this->belongsTo(LogisticsHub::class, 'origin_hub_id');
    }

    public function destinationHub(): BelongsTo
    {
        return $this->belongsTo(LogisticsHub::class, 'destination_hub_id');
    }
}
