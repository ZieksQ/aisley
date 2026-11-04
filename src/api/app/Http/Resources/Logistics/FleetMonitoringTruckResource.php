<?php

namespace App\Http\Resources\Logistics;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FleetMonitoringTruckResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $trip = $this->trips->first();
        $load = $trip?->parcel_count ?? 0;

        return [
            'id' => $this->id,
            'plate_number' => $this->plate_number,
            'make' => $this->make,
            'model' => $this->model,
            'is_active' => $this->is_active,
            'availability' => $this->availability->value,
            'home_hub' => $this->homeHub ? ['id' => $this->homeHub->id, 'name' => $this->homeHub->name] : null,
            'last_confirmed_hub' => $this->lastConfirmedHub ? ['id' => $this->lastConfirmedHub->id, 'name' => $this->lastConfirmedHub->name] : null,
            'max_parcels' => $this->max_parcels,
            'reserved_or_onboard_parcels' => $load,
            'remaining_capacity' => max(0, $this->max_parcels - $load),
            'active_trip' => $trip ? (new FleetMonitoringTripResource($trip))->resolve($request) : null,
        ];
    }
}
