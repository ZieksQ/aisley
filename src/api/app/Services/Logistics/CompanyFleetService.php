<?php

namespace App\Services\Logistics;

use App\Enums\CourierAffiliationStatus;
use App\Enums\Logistics\CompanyTruckAvailability;
use App\Enums\Logistics\LinehaulTripStatus;
use App\Enums\UserStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\CompanyTruck;
use App\Models\CourierLogisticsAffiliation;
use App\Models\LinehaulTrip;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class CompanyFleetService
{
    public function trucks(User $actor): Collection
    {
        $org = $this->organization($actor);

        return CompanyTruck::query()->where('logistics_organization_id', $org->id)
            ->with(['homeHub:id,name', 'lastConfirmedHub:id,name', 'trips' => fn ($query) => $query->with(['driver.courierProfile', 'fromHub:id,name', 'toHub:id,name'])->latest()->limit(20)])
            ->orderBy('plate_number')->get()->map(fn (CompanyTruck $truck): array => $this->projection($truck));
    }

    public function create(User $actor, array $input): array
    {
        $org = $this->organization($actor);
        $truck = CompanyTruck::create([
            ...$input,
            'logistics_organization_id' => $org->id,
            'home_hub_id' => $org->hub->id,
            'last_confirmed_hub_id' => $org->hub->id,
            'availability' => CompanyTruckAvailability::Available,
        ]);

        return $this->projection($truck->fresh(['homeHub:id,name', 'lastConfirmedHub:id,name', 'trips']));
    }

    public function update(User $actor, string $id, array $input): array
    {
        return DB::transaction(function () use ($actor, $id, $input): array {
            $org = $this->organization($actor);
            $truck = CompanyTruck::query()->whereKey($id)->where('logistics_organization_id', $org->id)->lockForUpdate()->first();
            if ($truck === null) {
                throw FulfillmentException::notFound('COMPANY_TRUCK_NOT_FOUND', 'This company truck is unavailable.');
            }
            if ($truck->revision !== (int) $input['expected_revision']) {
                throw FulfillmentException::conflict('COMPANY_TRUCK_CHANGED', 'The company truck changed. Refresh and try again.');
            }
            $activeTrips = LinehaulTrip::query()->where('company_truck_id', $truck->id)
                ->whereIn('status', [LinehaulTripStatus::PendingAcceptance->value, LinehaulTripStatus::Scheduled->value, LinehaulTripStatus::InTransfer->value])
                ->lockForUpdate()->get();
            $activeLoad = $activeTrips->sum('parcel_count');
            if (isset($input['max_parcels']) && (int) $input['max_parcels'] < $activeLoad) {
                throw FulfillmentException::conflict('COMPANY_TRUCK_CAPACITY_IN_USE', "Capacity cannot be lower than the {$activeLoad} reserved or onboard parcels.");
            }
            if (($input['is_active'] ?? true) === false && $activeTrips->isNotEmpty()) {
                throw FulfillmentException::conflict('COMPANY_TRUCK_ASSIGNED', 'An assigned truck cannot be deactivated.');
            }
            unset($input['expected_revision']);
            if (array_key_exists('is_active', $input) && ! $input['is_active']) {
                $input['availability'] = CompanyTruckAvailability::Inactive;
            } elseif (($input['is_active'] ?? false) && $truck->availability === CompanyTruckAvailability::Inactive) {
                $input['availability'] = CompanyTruckAvailability::Available;
            }
            $truck->update([...$input, 'revision' => $truck->revision + 1]);

            return $this->projection($truck->fresh(['homeHub:id,name', 'lastConfirmedHub:id,name', 'trips.driver.courierProfile', 'trips.fromHub:id,name', 'trips.toHub:id,name']));
        }, 3);
    }

    public function drivers(User $actor): Collection
    {
        $org = $this->organization($actor);

        return CourierLogisticsAffiliation::query()->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id)
            ->where('status', CourierAffiliationStatus::Approved)->whereHas('courier', fn ($query) => $query->where('status', UserStatus::Active))
            ->with('courier.courierProfile')->orderBy('created_at')->get()->map(fn (CourierLogisticsAffiliation $affiliation): array => [
                'courier_id' => $affiliation->courier_id,
                'name' => trim(($affiliation->courier->courierProfile?->first_name ?? '').' '.($affiliation->courier->courierProfile?->last_name ?? '')) ?: $affiliation->courier->email,
                'email' => $affiliation->courier->email,
                'can_drive_company_truck' => $affiliation->can_drive_company_truck,
                'revision' => $affiliation->truck_driver_revision,
            ])->values();
    }

    public function updateDriver(User $actor, string $courierId, bool $allowed, int $expectedRevision): array
    {
        return DB::transaction(function () use ($actor, $courierId, $allowed, $expectedRevision): array {
            $org = $this->organization($actor);
            $affiliation = CourierLogisticsAffiliation::query()->where('courier_id', $courierId)
                ->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id)
                ->where('status', CourierAffiliationStatus::Approved)->lockForUpdate()->first();
            if ($affiliation === null) {
                throw FulfillmentException::notFound('COURIER_NOT_FOUND', 'This Courier is unavailable.');
            }
            if ($affiliation->truck_driver_revision !== $expectedRevision) {
                throw FulfillmentException::conflict('TRUCK_DRIVER_CAPABILITY_CHANGED', 'The driver capability changed. Refresh and try again.');
            }
            if (! $allowed && LinehaulTrip::query()->where('driver_id', $courierId)->whereIn('status', [LinehaulTripStatus::PendingAcceptance->value, LinehaulTripStatus::Scheduled->value, LinehaulTripStatus::InTransfer->value])->exists()) {
                throw FulfillmentException::conflict('TRUCK_DRIVER_ASSIGNED', 'A driver with an active linehaul assignment cannot be disabled.');
            }
            $affiliation->update(['can_drive_company_truck' => $allowed, 'truck_driver_revision' => $affiliation->truck_driver_revision + 1]);

            return ['courier_id' => $courierId, 'can_drive_company_truck' => $affiliation->can_drive_company_truck, 'revision' => $affiliation->truck_driver_revision];
        }, 3);
    }

    public function projection(CompanyTruck $truck): array
    {
        $active = $truck->trips->first(fn (LinehaulTrip $trip) => in_array($trip->status, [LinehaulTripStatus::PendingAcceptance, LinehaulTripStatus::Scheduled, LinehaulTripStatus::InTransfer], true));
        $load = $active?->parcel_count ?? 0;

        return [
            'id' => $truck->id,
            'plate_number' => $truck->plate_number,
            'make' => $truck->make,
            'model' => $truck->model,
            'max_parcels' => $truck->max_parcels,
            'reserved_or_onboard_parcels' => $load,
            'remaining_capacity' => max(0, $truck->max_parcels - $load),
            'is_active' => $truck->is_active,
            'availability' => $truck->availability->value,
            'home_hub' => $truck->homeHub ? ['id' => $truck->homeHub->id, 'name' => $truck->homeHub->name] : null,
            'last_confirmed_hub' => $truck->lastConfirmedHub ? ['id' => $truck->lastConfirmedHub->id, 'name' => $truck->lastConfirmedHub->name] : null,
            'revision' => $truck->revision,
            'active_trip' => $active ? $this->tripSummary($active) : null,
            'trip_history' => $truck->trips->map(fn (LinehaulTrip $trip): array => $this->tripSummary($trip))->values()->all(),
        ];
    }

    private function tripSummary(LinehaulTrip $trip): array
    {
        $profile = $trip->driver?->courierProfile;

        return [
            'id' => $trip->id,
            'direction' => $trip->direction->value,
            'status' => $trip->status->value,
            'from_hub' => $trip->fromHub?->name,
            'to_hub' => $trip->toHub?->name,
            'driver' => trim(($profile?->first_name ?? '').' '.($profile?->last_name ?? '')) ?: $trip->driver?->email,
            'parcel_count' => $trip->parcel_count,
            'capacity_snapshot' => $trip->capacity_snapshot,
            'scheduled_for' => $trip->scheduled_for?->toISOString(),
        ];
    }

    private function organization(User $actor)
    {
        $org = $actor->logisticsOrganization()->with('hub')->first();
        if ($org === null || $org->hub === null) {
            throw FulfillmentException::notFound('LOGISTICS_CONTEXT_NOT_FOUND', 'The Logistics organization or operational hub is unavailable.');
        }

        return $org;
    }
}
