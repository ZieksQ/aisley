<?php

namespace App\Models;

use App\Enums\Logistics\HubRouteHopStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class ShipmentRouteHop extends Model
{
    use HasUuids;

    protected $fillable = ['shipment_route_id', 'hub_connection_id', 'sequence', 'from_hub_id', 'to_hub_id', 'status', 'revision', 'distance_meters', 'duration_seconds', 'source_fingerprint', 'destination_fingerprint', 'provider', 'provider_status', 'provider_request_id', 'metric_calculated_at', 'departed_by', 'arrived_by', 'departed_at', 'arrived_at', 'source_lane'];

    protected function casts(): array
    {
        return ['status' => HubRouteHopStatus::class, 'revision' => 'integer', 'sequence' => 'integer', 'distance_meters' => 'float', 'duration_seconds' => 'float', 'source_lane' => 'array', 'departed_at' => 'immutable_datetime', 'arrived_at' => 'immutable_datetime', 'metric_calculated_at' => 'immutable_datetime'];
    }
}
