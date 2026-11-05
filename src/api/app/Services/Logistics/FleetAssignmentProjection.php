<?php

namespace App\Services\Logistics;

use App\Models\DeliveryTask;
use App\Models\FirstMileTask;
use App\Models\LinehaulTrip;
use App\Models\User;

class FleetAssignmentProjection
{
    public function resolve(string $stage, FirstMileTask|DeliveryTask|LinehaulTrip $work): array
    {
        $courier = $stage === 'linehaul' ? $work->driver : $work->courier;
        $base = [
            'id' => $stage.':'.$work->id, 'source_id' => $work->id, 'stage' => $stage,
            'status' => $work->status->value, 'courier' => $this->courier($courier),
            'updated_at' => $work->updated_at?->toISOString(),
        ];

        return [...$base, ...match ($stage) {
            'first_mile' => $this->pickup($work),
            'linehaul' => $this->linehaul($work),
            'final_mile' => $this->delivery($work),
        }];
    }

    private function pickup(FirstMileTask $task): array
    {
        $pickup = $task->waybill?->snapshot?->payload['pickup'] ?? [];

        return [
            'reference' => $task->waybill?->reference ?? $task->id,
            'scheduled_for' => $task->schedule?->starts_at?->toISOString(),
            'schedule_ends_at' => $task->schedule?->ends_at?->toISOString(),
            'schedule_reference' => $task->schedule?->reference,
            'parcel_count' => 1, 'truck' => null, 'direction' => null,
            'events' => ['accepted_at' => $task->accepted_at?->toISOString(), 'picked_up_at' => $task->picked_up_at?->toISOString()],
            'stops' => [
                $this->stop('pickup', 'Seller pickup', is_array($pickup) ? $pickup : []),
                $this->hubStop('hub', $task->schedule?->hub),
            ],
        ];
    }

    private function delivery(DeliveryTask $task): array
    {
        return [
            'reference' => $task->shipment?->parcel?->reference ?? $task->id,
            'scheduled_for' => $task->getRelation('monitoringSchedule')?->scheduled_for?->toISOString(),
            'schedule_ends_at' => null, 'schedule_reference' => $task->getRelation('monitoringSchedule')?->reference,
            'parcel_count' => 1, 'truck' => null, 'direction' => null,
            'events' => [
                'accepted_at' => $task->accepted_at?->toISOString(), 'picked_up_at' => $task->picked_up_at?->toISOString(),
                'in_transit_at' => $task->in_transit_at?->toISOString(), 'out_for_delivery_at' => $task->out_for_delivery_at?->toISOString(),
            ],
            'stops' => [
                $this->hubStop('hub', $task->shipment?->currentHub),
                $this->stop('delivery', 'Delivery destination', $task->shipment?->parcel?->order?->address?->toArray() ?? []),
            ],
        ];
    }

    private function linehaul(LinehaulTrip $trip): array
    {
        return [
            'reference' => $trip->truck?->plate_number ?? $trip->id,
            'scheduled_for' => $trip->scheduled_for?->toISOString(), 'schedule_ends_at' => null, 'schedule_reference' => null,
            'parcel_count' => $trip->parcel_count,
            'truck' => $trip->truck ? ['id' => $trip->truck->id, 'plate_number' => $trip->truck->plate_number] : null,
            'direction' => $trip->direction->value,
            'events' => [
                'released_for_departure_at' => $trip->released_for_departure_at?->toISOString(),
                'departed_at' => $trip->departed_at?->toISOString(), 'courier_arrived_at' => $trip->courier_arrived_at?->toISOString(),
                'arrived_at' => $trip->arrived_at?->toISOString(),
            ],
            'stops' => [$this->hubStop('origin', $trip->fromHub), $this->hubStop('destination', $trip->toHub)],
        ];
    }

    private function courier(?User $courier): ?array
    {
        return $courier ? ['id' => $courier->id, 'name' => trim(($courier->courierProfile?->first_name ?? '').' '.($courier->courierProfile?->last_name ?? '')) ?: 'Assigned courier'] : null;
    }

    private function hubStop(string $kind, mixed $hub): array
    {
        return $this->stop($kind, $hub?->name ?? 'Hub unavailable', $hub?->address?->toArray() ?? []);
    }

    private function stop(string $kind, string $label, array $address): array
    {
        $lat = $address['latitude'] ?? null;
        $lng = $address['longitude'] ?? null;
        $valid = is_numeric($lat) && is_numeric($lng) && is_finite((float) $lat) && is_finite((float) $lng)
            && abs((float) $lat) <= 90 && abs((float) $lng) <= 180;

        return [
            'kind' => $kind, 'label' => $label,
            'area' => implode(', ', array_filter([$address['barangay'] ?? null, $address['city_municipality'] ?? null, $address['province'] ?? null])),
            'latitude' => $valid ? (float) $lat : null, 'longitude' => $valid ? (float) $lng : null,
        ];
    }
}
