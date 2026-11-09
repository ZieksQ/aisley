<?php

namespace App\Http\Resources\Logistics;

use App\Enums\Logistics\LinehaulTripStatus;
use App\Models\LogisticsHub;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FleetMonitoringTripResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $profile = $this->driver?->courierProfile;
        $name = trim(($profile?->first_name ?? '').' '.($profile?->last_name ?? ''));
        $at = $request->attributes->get('fleet_monitoring_time', now());

        return [
            'id' => $this->id,
            'direction' => $this->direction->value,
            'status' => $this->status->value,
            'from_hub' => $this->hub($this->fromHub),
            'to_hub' => $this->hub($this->toHub),
            'manifest_id' => $this->linehaul_manifest_id,
            'driver' => $this->driver ? ['id' => $this->driver->id, 'name' => $name ?: 'Assigned driver'] : null,
            'parcel_count' => $this->parcel_count,
            'capacity_snapshot' => $this->capacity_snapshot,
            'scheduled_for' => $this->scheduled_for?->toISOString(),
            'overdue' => in_array($this->status, [LinehaulTripStatus::PendingAcceptance, LinehaulTripStatus::Scheduled], true)
                && $this->departed_at === null && $this->scheduled_for?->lt($at),
            'decided_at' => $this->decided_at?->toISOString(),
            'released_for_departure_at' => $this->released_for_departure_at?->toISOString(),
            'departed_at' => $this->departed_at?->toISOString(),
            'courier_arrived_at' => $this->courier_arrived_at?->toISOString(),
            'arrived_at' => $this->arrived_at?->toISOString(),
            'unloading_closed_at' => $this->unloading_closed_at?->toISOString(),
            'received_at' => $this->received_at?->toISOString(),
        ];
    }

    private function hub(?LogisticsHub $hub): ?array
    {
        if ($hub === null) {
            return null;
        }
        $latitude = $hub->address?->latitude;
        $longitude = $hub->address?->longitude;
        $valid = is_numeric($latitude) && is_numeric($longitude)
            && is_finite((float) $latitude) && is_finite((float) $longitude)
            && abs((float) $latitude) <= 90 && abs((float) $longitude) <= 180;

        return [
            'id' => $hub->id, 'name' => $hub->name,
            'logistics' => $hub->organization ? ['id' => $hub->organization->id, 'name' => $hub->organization->business_name] : null,
            'latitude' => $valid ? (float) $latitude : null,
            'longitude' => $valid ? (float) $longitude : null,
        ];
    }
}
