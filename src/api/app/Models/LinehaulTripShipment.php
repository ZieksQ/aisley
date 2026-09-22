<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LinehaulTripShipment extends Model
{
    use HasUuids;

    protected $fillable = [
        'linehaul_trip_id', 'shipment_id', 'shipment_route_hop_id', 'sequence',
        'shipment_revision_reserved', 'hop_revision_reserved', 'released_at',
    ];

    protected function casts(): array
    {
        return ['released_at' => 'datetime'];
    }

    public function trip(): BelongsTo
    {
        return $this->belongsTo(LinehaulTrip::class, 'linehaul_trip_id');
    }

    public function shipment(): BelongsTo
    {
        return $this->belongsTo(Shipment::class);
    }

    public function hop(): BelongsTo
    {
        return $this->belongsTo(ShipmentRouteHop::class, 'shipment_route_hop_id');
    }
}
