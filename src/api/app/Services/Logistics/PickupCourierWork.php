<?php

namespace App\Services\Logistics;

use App\Models\FirstMileTask;
use Illuminate\Database\Eloquent\Builder;

class PickupCourierWork
{
    /** Include legacy completed schedules whose parcels have not reached the hub. */
    public static function query(?string $courierId = null): Builder
    {
        return FirstMileTask::query()
            ->when($courierId, fn ($query) => $query->where('courier_id', $courierId))
            ->where(fn ($query) => $query->whereIn('status', ['assigned', 'accepted'])
                ->orWhere(fn ($picked) => $picked->where('status', 'picked_up_from_seller')
                    ->whereDoesntHave('order.parcel.shipment', fn ($shipment) => $shipment->whereNotNull('received_at_hub_at'))));
    }
}
