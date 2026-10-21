<?php

namespace App\Services\Logistics;

use App\Enums\Logistics\LinehaulTripStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\LinehaulTrip;
use App\Models\User;
use App\Services\Logistics\Sorting\SortingLocks;
use Illuminate\Support\Facades\DB;

class LinehaulReleaseService
{
    public function release(User $actor, string $id, int $revision): array
    {
        return DB::transaction(function () use ($actor, $id, $revision): array {
            $org = $actor->logisticsOrganization()->with('hub')->first();
            if ($org?->hub === null) {
                throw FulfillmentException::notFound();
            }
            SortingLocks::hub($org->hub->id);
            $trip = LinehaulTrip::query()->whereKey($id)->where('from_hub_id', $org->hub->id)
                ->with(['shipments.shipment', 'shipments.hop'])->lockForUpdate()->first();
            if ($trip === null) {
                throw FulfillmentException::notFound('LINEHAUL_TRIP_NOT_FOUND', 'This source trip is unavailable.');
            }
            if ($trip->status !== LinehaulTripStatus::Scheduled) {
                throw FulfillmentException::conflict('LINEHAUL_TRIP_CHANGED', 'Only an approved scheduled trip can be released.');
            }
            $service = app(LinehaulTripService::class);
            if ($trip->released_for_departure_at === null) {
                if ($trip->revision !== $revision) {
                    throw FulfillmentException::conflict('LINEHAUL_TRIP_CHANGED', 'The trip changed. Refresh before releasing it.');
                }
                $service->validateDeparture($trip);
                $trip->update(['released_for_departure_at' => now(), 'released_for_departure_by' => $actor->id, 'revision' => $trip->revision + 1]);
            }

            return $service->projection($trip->fresh(['truck', 'shipments.shipment.parcel.waybill', 'fromHub', 'toHub']), $org->hub->id);
        }, 3);
    }
}
