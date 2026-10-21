<?php

namespace App\Services\Courier;

use App\Enums\Logistics\LinehaulTripStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\LinehaulTrip;
use App\Models\User;
use App\Services\Logistics\LinehaulTripService;
use App\Services\Logistics\Sorting\SortingLocks;
use Illuminate\Support\Facades\DB;

class LinehaulTripActionService
{
    public function depart(User $courier, string $id, int $revision): array
    {
        return DB::transaction(function () use ($courier, $id, $revision): array {
            $trip = $this->lockedTrip($courier, $id);
            if ($trip->departed_at !== null && in_array($trip->status, [LinehaulTripStatus::InTransfer, LinehaulTripStatus::Receiving, LinehaulTripStatus::Received], true)) {
                return $this->projection($trip);
            }
            $this->assertRevision($trip, $revision, LinehaulTripStatus::Scheduled);
            if ($trip->released_for_departure_at === null) {
                throw FulfillmentException::conflict('LINEHAUL_RELEASE_REQUIRED', 'Origin Logistics must release the load before you depart.');
            }
            // Execute the authorized cargo release through its recorded source
            // authorizer. The actual initiating driver is recorded separately;
            // neither identity nor source authority is accepted from the client.
            $authorizer = User::query()->whereKey($trip->released_for_departure_by)->where('role', UserRole::Logistics)
                ->where('status', UserStatus::Active)->whereHas('logisticsOrganization.hub', fn ($query) => $query->whereKey($trip->from_hub_id))->first();
            if ($authorizer === null) {
                throw FulfillmentException::conflict('LINEHAUL_RELEASE_INVALID', 'The source release authorization is no longer available. Contact Logistics.');
            }
            $trip->update(['departed_by' => $courier->id]);
            app(LinehaulTripService::class)->depart($authorizer, $trip->id, $revision);

            return $this->projection($trip->fresh());
        }, 3);
    }

    public function arrival(User $courier, string $id, int $revision): array
    {
        return DB::transaction(function () use ($courier, $id, $revision): array {
            $trip = $this->lockedTrip($courier, $id);
            if ($trip->courier_arrived_at !== null && $trip->courier_arrived_by === $courier->id) {
                return $this->projection($trip);
            }
            $this->assertRevision($trip, $revision, LinehaulTripStatus::InTransfer);
            if ($trip->departed_at === null || $trip->courier_arrived_at !== null) {
                throw FulfillmentException::conflict('LINEHAUL_TRIP_CHANGED', 'Refresh the departed trip before reporting arrival.');
            }
            $trip->update(['courier_arrived_at' => now(), 'courier_arrived_by' => $courier->id, 'revision' => $trip->revision + 1]);

            return $this->projection($trip);
        }, 3);
    }

    private function lockedTrip(User $courier, string $id): LinehaulTrip
    {
        $source = LinehaulTrip::query()->whereKey($id)->where('driver_id', $courier->id)->value('from_hub_id');
        if ($source === null) {
            throw FulfillmentException::notFound('LINEHAUL_TRIP_NOT_FOUND', 'The assigned linehaul trip is unavailable.');
        }
        SortingLocks::hub($source);
        $trip = LinehaulTrip::query()->whereKey($id)->where('driver_id', $courier->id)->lockForUpdate()->first();
        if ($trip === null || $trip->from_hub_id !== $source) {
            throw FulfillmentException::notFound('LINEHAUL_TRIP_NOT_FOUND', 'The assigned linehaul trip is unavailable.');
        }

        return $trip;
    }

    private function assertRevision(LinehaulTrip $trip, int $revision, LinehaulTripStatus $status): void
    {
        if ($trip->revision !== $revision || $trip->status !== $status) {
            throw FulfillmentException::conflict('LINEHAUL_TRIP_CHANGED', 'The trip changed. Refresh before confirming this action.');
        }
    }

    private function projection(LinehaulTrip $trip): array
    {
        return app(LinehaulTripService::class)->courierProjection($trip->load(['truck', 'fromHub', 'toHub', 'shipments.shipment.parcel.waybill']));
    }
}
