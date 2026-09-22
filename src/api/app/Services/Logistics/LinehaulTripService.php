<?php

namespace App\Services\Logistics;

use App\Enums\CourierAffiliationStatus;
use App\Enums\Logistics\CompanyTruckAvailability;
use App\Enums\Logistics\HubRouteHopStatus;
use App\Enums\Logistics\LinehaulTripDirection;
use App\Enums\Logistics\LinehaulTripStatus;
use App\Enums\Logistics\SortingLaneType;
use App\Enums\ShipmentStatus;
use App\Enums\UserStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\CompanyTruck;
use App\Models\CourierLogisticsAffiliation;
use App\Models\DeliveryTask;
use App\Models\DispatchSchedule;
use App\Models\HubConnection;
use App\Models\LinehaulTrip;
use App\Models\LinehaulTripShipment;
use App\Models\LogisticsHub;
use App\Models\PickupSchedule;
use App\Models\Shipment;
use App\Models\User;
use App\Services\Courier\CourierNotificationService;
use App\Services\Logistics\Routing\LinehaulService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class LinehaulTripService
{
    private const ACTIVE = ['pending_acceptance', 'scheduled', 'in_transfer'];

    public function overview(User $actor): array
    {
        $org = $this->organization($actor);
        $load = ['truck', 'driver.courierProfile', 'fromHub:id,name', 'toHub:id,name', 'shipments.shipment.parcel.waybill', 'returnTrip'];

        return [
            'enabled' => LinehaulService::enabled(),
            'ready_groups' => app(LinehaulService::class)->readyGroups($actor),
            'trucks' => CompanyTruck::query()->where('logistics_organization_id', $org->id)->where('is_active', true)->where('availability', CompanyTruckAvailability::Available)->orderBy('plate_number')->get()->map(fn (CompanyTruck $truck): array => $this->truckOption($truck))->values(),
            'drivers' => $this->eligibleDrivers($org->id, $org->hub->id),
            'outbound' => LinehaulTrip::query()->where('owner_logistics_organization_id', $org->id)->with($load)->latest()->limit(50)->get()->map(fn (LinehaulTrip $trip): array => $this->projection($trip, $org->hub->id))->values(),
            'inbound' => LinehaulTrip::query()->where('to_hub_id', $org->hub->id)->with($load)->latest()->limit(50)->get()->map(fn (LinehaulTrip $trip): array => $this->projection($trip, $org->hub->id))->values(),
            'visitors' => LinehaulTrip::query()->where('to_hub_id', $org->hub->id)->where('direction', LinehaulTripDirection::Outbound)->where('status', LinehaulTripStatus::Received)
                ->whereDoesntHave('returnTrip')->with($load)->latest()->get()->map(fn (LinehaulTrip $trip): array => $this->projection($trip, $org->hub->id))->values(),
        ];
    }

    public function scheduleOutbound(User $actor, array $input, string $key): array
    {
        return DB::transaction(function () use ($actor, $input, $key): array {
            $org = $this->organization($actor);
            LogisticsHub::query()->whereKey($org->hub->id)->lockForUpdate()->firstOrFail();
            if (($prior = LinehaulTrip::query()->where('requested_by', $actor->id)->where('idempotency_key', $key)->first()) !== null) {
                return $this->idempotent($prior, $input, $org->hub->id);
            }
            $this->assertFeature();
            $target = LogisticsHub::query()->whereKey($input['next_hub_id'])->whereKeyNot($org->hub->id)->lockForUpdate()->first();
            if ($target === null) {
                throw FulfillmentException::invalid('LINEHAUL_TARGET_INVALID', 'Choose an available destination Logistics hub.', 'next_hub_id');
            }
            $this->assertConnections($org->hub->id, $target->id);
            $truck = $this->ownedAvailableTruck($org->id, $org->hub->id, $input['company_truck_id']);
            $this->qualifiedDriver($org->id, $org->hub->id, $input['driver_id']);
            $this->assertResourcesFree($truck->id, $input['driver_id']);
            if (count($input['shipment_ids']) > $truck->max_parcels) {
                throw FulfillmentException::invalid('LINEHAUL_CAPACITY_EXCEEDED', 'The selected parcels exceed the assigned truck capacity.', 'shipment_ids');
            }
            $items = $this->reserveItems($org->id, $org->hub->id, $target->id, $truck->max_parcels, $input['shipment_ids']);
            if ($items->isEmpty()) {
                throw FulfillmentException::conflict('LINEHAUL_NO_READY_PARCELS', 'No unreserved sorted parcels are ready for that destination.');
            }
            $trip = LinehaulTrip::create([
                'owner_logistics_organization_id' => $org->id,
                'home_hub_id' => $org->hub->id,
                'from_hub_id' => $org->hub->id,
                'to_hub_id' => $target->id,
                'company_truck_id' => $truck->id,
                'driver_id' => $input['driver_id'],
                'requested_by' => $actor->id,
                'direction' => LinehaulTripDirection::Outbound,
                'status' => LinehaulTripStatus::PendingAcceptance,
                'scheduled_for' => $input['scheduled_for'],
                'capacity_snapshot' => $truck->max_parcels,
                'parcel_count' => $items->count(),
                'idempotency_key' => $key,
                'request_hash' => $this->hash($input),
            ]);
            $this->createMembers($trip, $items);
            $truck->update(['availability' => CompanyTruckAvailability::Reserved, 'revision' => $truck->revision + 1]);

            return $this->projection($this->load($trip), $org->hub->id);
        }, 3);
    }

    public function decide(User $actor, string $id, bool $accept, ?string $reason, int $expectedRevision): array
    {
        return DB::transaction(function () use ($actor, $id, $accept, $reason, $expectedRevision): array {
            $org = $this->organization($actor);
            LogisticsHub::query()->whereKey($org->hub->id)->lockForUpdate()->firstOrFail();
            $trip = LinehaulTrip::query()->whereKey($id)->where('to_hub_id', $org->hub->id)->where('direction', LinehaulTripDirection::Outbound)->lockForUpdate()->first();
            if ($trip === null) {
                throw FulfillmentException::notFound('LINEHAUL_TRIP_NOT_FOUND', 'This inbound linehaul request is unavailable.');
            }
            if ($trip->revision !== $expectedRevision) {
                throw FulfillmentException::conflict('LINEHAUL_TRIP_CHANGED', 'The linehaul request changed. Refresh and try again.');
            }
            if ($trip->status !== LinehaulTripStatus::PendingAcceptance) {
                throw FulfillmentException::conflict('LINEHAUL_DECISION_CLOSED', 'This linehaul request has already been decided.');
            }
            if ($accept) {
                $this->assertFeature();
                $this->assertConnections($trip->from_hub_id, $trip->to_hub_id);
                $trip->update(['status' => LinehaulTripStatus::Scheduled, 'decided_by' => $actor->id, 'decided_at' => now(), 'revision' => $trip->revision + 1]);
            } else {
                $trip->update(['status' => LinehaulTripStatus::Rejected, 'decided_by' => $actor->id, 'decided_at' => now(), 'rejection_reason' => trim((string) $reason) ?: null, 'revision' => $trip->revision + 1]);
                $this->release($trip);
            }

            return $this->projection($this->load($trip), $org->hub->id);
        }, 3);
    }

    public function cancel(User $actor, string $id, int $expectedRevision): array
    {
        return DB::transaction(function () use ($actor, $id, $expectedRevision): array {
            $org = $this->organization($actor);
            LogisticsHub::query()->whereKey($org->hub->id)->lockForUpdate()->firstOrFail();
            $trip = LinehaulTrip::query()->whereKey($id)->where('from_hub_id', $org->hub->id)->lockForUpdate()->first();
            if ($trip === null) {
                throw FulfillmentException::notFound('LINEHAUL_TRIP_NOT_FOUND', 'This linehaul trip is unavailable.');
            }
            if ($trip->revision !== $expectedRevision || ! in_array($trip->status, [LinehaulTripStatus::PendingAcceptance, LinehaulTripStatus::Scheduled], true)) {
                throw FulfillmentException::conflict('LINEHAUL_TRIP_CHANGED', 'Only the current pre-departure trip can be cancelled.');
            }
            $trip->update(['status' => LinehaulTripStatus::Cancelled, 'revision' => $trip->revision + 1]);
            $this->release($trip);

            return $this->projection($this->load($trip), $org->hub->id);
        }, 3);
    }

    public function depart(User $actor, string $id, int $expectedRevision): array
    {
        return DB::transaction(function () use ($actor, $id, $expectedRevision): array {
            $org = $this->organization($actor);
            LogisticsHub::query()->whereKey($org->hub->id)->lockForUpdate()->firstOrFail();
            $trip = LinehaulTrip::query()->whereKey($id)->where('from_hub_id', $org->hub->id)->with(['truck', 'shipments.shipment.parcel.waybill', 'shipments.hop'])->lockForUpdate()->first();
            if ($trip === null) {
                throw FulfillmentException::notFound('LINEHAUL_TRIP_NOT_FOUND', 'This linehaul trip is unavailable.');
            }
            if ($trip->status === LinehaulTripStatus::InTransfer) {
                return $this->projection($this->load($trip), $org->hub->id);
            }
            if ($trip->revision !== $expectedRevision || $trip->status !== LinehaulTripStatus::Scheduled) {
                throw FulfillmentException::conflict('LINEHAUL_TRIP_CHANGED', 'This trip is not ready to depart.');
            }
            $this->assertFeature();
            $this->assertConnections($trip->from_hub_id, $trip->to_hub_id);
            $this->revalidateResources($trip);
            if ($trip->parcel_count > 0) {
                $manifest = app(LinehaulService::class)->departTrip($actor, $trip);
                $trip->linehaul_manifest_id = $manifest['id'];
            }
            $trip->status = LinehaulTripStatus::InTransfer;
            $trip->departed_at = now();
            $trip->revision++;
            $trip->save();
            $trip->truck()->update(['availability' => CompanyTruckAvailability::InTransit, 'last_confirmed_hub_id' => null, 'revision' => DB::raw('revision + 1')]);

            return $this->projection($this->load($trip), $org->hub->id);
        }, 3);
    }

    public function receive(User $actor, string $id, int $expectedRevision): array
    {
        return DB::transaction(function () use ($actor, $id, $expectedRevision): array {
            $org = $this->organization($actor);
            LogisticsHub::query()->whereKey($org->hub->id)->lockForUpdate()->firstOrFail();
            $trip = LinehaulTrip::query()->whereKey($id)->where('to_hub_id', $org->hub->id)->with('truck')->lockForUpdate()->first();
            if ($trip === null) {
                throw FulfillmentException::notFound('LINEHAUL_TRIP_NOT_FOUND', 'This arriving linehaul trip is unavailable.');
            }
            if ($trip->status === LinehaulTripStatus::Received) {
                return $this->projection($this->load($trip), $org->hub->id);
            }
            if ($trip->revision !== $expectedRevision || $trip->status !== LinehaulTripStatus::InTransfer) {
                throw FulfillmentException::conflict('LINEHAUL_TRIP_CHANGED', 'This trip is not ready to receive.');
            }
            if ($trip->linehaul_manifest_id !== null) {
                app(LinehaulService::class)->arrive($actor, $trip->linehaul_manifest_id);
            }
            $trip->update(['status' => LinehaulTripStatus::Received, 'received_at' => now(), 'revision' => $trip->revision + 1]);
            $trip->shipments()->update(['released_at' => now()]);
            $home = $trip->direction === LinehaulTripDirection::Return;
            $trip->truck()->update([
                'availability' => $home ? CompanyTruckAvailability::Available : CompanyTruckAvailability::Visiting,
                'last_confirmed_hub_id' => $org->hub->id,
                'revision' => DB::raw('revision + 1'),
            ]);

            return $this->projection($this->load($trip), $org->hub->id);
        }, 3);
    }

    public function scheduleReturn(User $actor, string $outboundId, array $input, string $key): array
    {
        return DB::transaction(function () use ($actor, $outboundId, $input, $key): array {
            $org = $this->organization($actor);
            LogisticsHub::query()->whereKey($org->hub->id)->lockForUpdate()->firstOrFail();
            if (($prior = LinehaulTrip::query()->where('requested_by', $actor->id)->where('idempotency_key', $key)->first()) !== null) {
                return $this->idempotent($prior, $input, $org->hub->id);
            }
            $outbound = LinehaulTrip::query()->whereKey($outboundId)->where('to_hub_id', $org->hub->id)->where('direction', LinehaulTripDirection::Outbound)
                ->where('status', LinehaulTripStatus::Received)->with(['truck', 'returnTrip'])->lockForUpdate()->first();
            if ($outbound === null || $outbound->returnTrip !== null || $outbound->truck?->availability !== CompanyTruckAvailability::Visiting || $outbound->truck?->last_confirmed_hub_id !== $org->hub->id) {
                throw FulfillmentException::conflict('LINEHAUL_VISITOR_UNAVAILABLE', 'This visiting truck and driver cannot be scheduled from this hub.');
            }
            $this->assertFeature();
            $this->assertConnections($org->hub->id, $outbound->home_hub_id);
            $this->assertResourcesFree($outbound->company_truck_id, $outbound->driver_id, $outbound->id);
            $items = collect();
            if (! $input['empty_return']) {
                $items = $this->reserveItems($org->id, $org->hub->id, $outbound->home_hub_id, $outbound->capacity_snapshot);
                if ($items->isEmpty()) {
                    throw FulfillmentException::conflict('LINEHAUL_NO_RETURN_CARGO', 'No return cargo is ready. Choose an empty return to continue without a manifest.');
                }
            }
            $trip = LinehaulTrip::create([
                'owner_logistics_organization_id' => $outbound->owner_logistics_organization_id,
                'home_hub_id' => $outbound->home_hub_id,
                'from_hub_id' => $org->hub->id,
                'to_hub_id' => $outbound->home_hub_id,
                'company_truck_id' => $outbound->company_truck_id,
                'driver_id' => $outbound->driver_id,
                'parent_trip_id' => $outbound->id,
                'requested_by' => $actor->id,
                'direction' => LinehaulTripDirection::Return,
                'status' => LinehaulTripStatus::Scheduled,
                'scheduled_for' => $input['scheduled_for'],
                'capacity_snapshot' => $outbound->capacity_snapshot,
                'parcel_count' => $items->count(),
                'idempotency_key' => $key,
                'request_hash' => $this->hash($input),
            ]);
            $this->createMembers($trip, $items);
            $outbound->truck->update(['availability' => CompanyTruckAvailability::Reserved, 'revision' => $outbound->truck->revision + 1]);
            app(LogisticsNotificationService::class)->queueLinehaulReturn($trip);
            app(CourierNotificationService::class)->queueLinehaulTrip($trip);

            return $this->projection($this->load($trip), $org->hub->id);
        }, 3);
    }

    public function courierTrips(User $courier): Collection
    {
        return LinehaulTrip::query()->where('driver_id', $courier->id)->with(['truck', 'fromHub:id,name', 'toHub:id,name', 'shipments.shipment.parcel.waybill'])
            ->latest()->limit(50)->get()->map(fn (LinehaulTrip $trip): array => $this->projection($trip, null))->values();
    }

    public function projection(LinehaulTrip $trip, ?string $viewerHub): array
    {
        $profile = $trip->driver?->courierProfile;
        $references = $trip->shipments->map(fn (LinehaulTripShipment $item): ?string => $item->shipment?->parcel?->waybill?->reference)->filter()->values()->all();

        return [
            'id' => $trip->id,
            'direction' => $trip->direction->value,
            'status' => $trip->status->value,
            'from_hub' => ['id' => $trip->from_hub_id, 'name' => $trip->fromHub?->name],
            'to_hub' => ['id' => $trip->to_hub_id, 'name' => $trip->toHub?->name],
            'truck' => ['id' => $trip->company_truck_id, 'plate_number' => $trip->truck?->plate_number, 'make' => $trip->truck?->make, 'model' => $trip->truck?->model],
            'driver' => ['id' => $trip->driver_id, 'name' => trim(($profile?->first_name ?? '').' '.($profile?->last_name ?? '')) ?: $trip->driver?->email, 'contact_number' => $profile?->contact_number],
            'scheduled_for' => $trip->scheduled_for?->toISOString(),
            'capacity_snapshot' => $trip->capacity_snapshot,
            'parcel_count' => $trip->parcel_count,
            'remaining_capacity' => max(0, $trip->capacity_snapshot - $trip->parcel_count),
            'references' => $references,
            'empty_return' => $trip->direction === LinehaulTripDirection::Return && $trip->parcel_count === 0,
            'rejection_reason' => $trip->rejection_reason,
            'revision' => $trip->revision,
            'can_decide' => $viewerHub === $trip->to_hub_id && $trip->direction === LinehaulTripDirection::Outbound && $trip->status === LinehaulTripStatus::PendingAcceptance,
            'can_depart' => $viewerHub === $trip->from_hub_id && $trip->status === LinehaulTripStatus::Scheduled,
            'can_receive' => $viewerHub === $trip->to_hub_id && $trip->status === LinehaulTripStatus::InTransfer,
            'can_schedule_return' => $viewerHub === $trip->to_hub_id && $trip->direction === LinehaulTripDirection::Outbound && $trip->status === LinehaulTripStatus::Received && $trip->returnTrip === null,
            'departed_at' => $trip->departed_at?->toISOString(),
            'received_at' => $trip->received_at?->toISOString(),
        ];
    }

    private function reserveItems(string $orgId, string $hubId, string $targetHubId, int $limit, ?array $shipmentIds = null): Collection
    {
        $shipments = Shipment::query()->where('current_logistics_organization_id', $orgId)->where('current_hub_id', $hubId)
            ->where('status', ShipmentStatus::SortedAtHub)->whereHas('route', fn ($query) => $query->where('status', 'planned'))
            ->when($shipmentIds !== null, fn ($query) => $query->whereKey($shipmentIds))
            ->with(['route.hops', 'parcel.waybill', 'sortingLane'])->orderBy('received_at_hub_at')->orderBy('id')->lockForUpdate()->get();
        if ($shipmentIds !== null && $shipments->count() !== count($shipmentIds)) {
            throw FulfillmentException::conflict('LINEHAUL_SELECTION_CHANGED', 'One or more selected parcels are no longer available. Refresh the linehaul dispatch list.');
        }
        $items = collect();
        foreach ($shipments as $shipment) {
            if ($items->count() >= $limit) {
                break;
            }
            $hop = $shipment->route?->hops->first(fn ($candidate) => $candidate->status === HubRouteHopStatus::Pending && $candidate->from_hub_id === $hubId && $candidate->to_hub_id === $targetHubId);
            if ($hop === null || LinehaulTripShipment::query()->where('shipment_route_hop_id', $hop->id)->whereNull('released_at')->exists()) {
                continue;
            }
            $lane = $shipment->sortingLane;
            if ($lane === null || ! $lane->is_active || $lane->type !== SortingLaneType::Standard
                || $lane->logistics_organization_id !== $orgId || $lane->logistics_hub_id !== $hubId) {
                continue;
            }
            $items->push(['shipment' => $shipment, 'hop' => $hop]);
        }

        if ($shipmentIds !== null && $items->count() !== count($shipmentIds)) {
            throw FulfillmentException::conflict('LINEHAUL_SELECTION_CHANGED', 'Every selected parcel must still be sorted, unreserved, and assigned to the chosen destination and lane. Refresh and try again.');
        }

        return $items;
    }

    private function createMembers(LinehaulTrip $trip, Collection $items): void
    {
        foreach ($items->values() as $index => $item) {
            LinehaulTripShipment::create([
                'linehaul_trip_id' => $trip->id,
                'shipment_id' => $item['shipment']->id,
                'shipment_route_hop_id' => $item['hop']->id,
                'sequence' => $index + 1,
                'shipment_revision_reserved' => $item['shipment']->revision,
                'hop_revision_reserved' => $item['hop']->revision,
            ]);
        }
    }

    private function assertConnections(string $from, string $to): void
    {
        foreach ([[$from, $to], [$to, $from]] as [$source, $destination]) {
            if (! HubConnection::query()->where('from_hub_id', $source)->where('to_hub_id', $destination)->where('is_active', true)->where('receiver_accepted', true)->exists()) {
                throw FulfillmentException::conflict('LINEHAUL_CONNECTION_REQUIRED', 'Active accepted routing connections are required in both directions before assigning a company truck.');
            }
        }
    }

    private function ownedAvailableTruck(string $orgId, string $hubId, string $truckId): CompanyTruck
    {
        $truck = CompanyTruck::query()->whereKey($truckId)->where('logistics_organization_id', $orgId)->where('home_hub_id', $hubId)
            ->where('is_active', true)->where('availability', CompanyTruckAvailability::Available)->lockForUpdate()->first();
        if ($truck === null || $truck->max_parcels < 1) {
            throw FulfillmentException::invalid('COMPANY_TRUCK_NOT_ELIGIBLE', 'Select an available company-owned truck with a configured parcel capacity.', 'company_truck_id');
        }

        return $truck;
    }

    private function qualifiedDriver(string $orgId, string $hubId, string $driverId): void
    {
        $valid = CourierLogisticsAffiliation::query()->where('courier_id', $driverId)->where('logistics_organization_id', $orgId)->where('logistics_hub_id', $hubId)
            ->where('status', CourierAffiliationStatus::Approved)->where('can_drive_company_truck', true)
            ->whereHas('courier', fn ($query) => $query->where('status', UserStatus::Active))->lockForUpdate()->exists();
        if (! $valid) {
            throw FulfillmentException::invalid('LINEHAUL_DRIVER_NOT_ELIGIBLE', 'Select an active approved Courier authorized to drive company trucks.', 'driver_id');
        }
    }

    private function assertResourcesFree(string $truckId, string $driverId, ?string $exceptTrip = null): void
    {
        $query = LinehaulTrip::query()->whereIn('status', self::ACTIVE)->where(fn ($query) => $query->where('company_truck_id', $truckId)->orWhere('driver_id', $driverId));
        if ($exceptTrip !== null) {
            $query->whereKeyNot($exceptTrip);
        }
        if ($query->lockForUpdate()->exists()) {
            throw FulfillmentException::conflict('LINEHAUL_RESOURCE_CONFLICT', 'The selected truck or driver already has active linehaul work.');
        }
        if (PickupSchedule::query()->where('courier_id', $driverId)->where('status', 'scheduled')->where('ends_at', '>=', now())->lockForUpdate()->exists()
            || DispatchSchedule::query()->where('courier_id', $driverId)->where('status', 'scheduled')->lockForUpdate()->exists()
            || DeliveryTask::query()->where('courier_id', $driverId)->whereIn('status', ['offered', 'delivery_assigned', 'accepted', 'picked_up_from_hub', 'out_for_delivery'])->lockForUpdate()->exists()) {
            throw FulfillmentException::conflict('LINEHAUL_DRIVER_WORK_CONFLICT', 'The selected driver has outstanding pickup or final-mile work.');
        }
    }

    private function revalidateResources(LinehaulTrip $trip): void
    {
        $truck = CompanyTruck::query()->whereKey($trip->company_truck_id)->lockForUpdate()->first();
        if ($truck === null || ! $truck->is_active || $truck->max_parcels < $trip->parcel_count || $trip->capacity_snapshot < $trip->parcel_count) {
            throw FulfillmentException::conflict('LINEHAUL_CAPACITY_CHANGED', 'The assigned truck can no longer carry the reserved load.');
        }
        $this->qualifiedDriver($trip->owner_logistics_organization_id, $trip->home_hub_id, $trip->driver_id);
        foreach ($trip->shipments as $item) {
            if ($item->released_at !== null || $item->shipment?->revision !== $item->shipment_revision_reserved || $item->hop?->revision !== $item->hop_revision_reserved) {
                throw FulfillmentException::conflict('LINEHAUL_RESERVATION_CHANGED', 'A reserved parcel changed before departure. Cancel and schedule a fresh load.');
            }
        }
    }

    private function release(LinehaulTrip $trip): void
    {
        $trip->shipments()->whereNull('released_at')->update(['released_at' => now()]);
        CompanyTruck::query()->whereKey($trip->company_truck_id)->update(['availability' => CompanyTruckAvailability::Available->value, 'revision' => DB::raw('revision + 1')]);
    }

    private function eligibleDrivers(string $orgId, string $hubId): Collection
    {
        return CourierLogisticsAffiliation::query()->where('logistics_organization_id', $orgId)->where('logistics_hub_id', $hubId)->where('status', CourierAffiliationStatus::Approved)
            ->where('can_drive_company_truck', true)->whereHas('courier', fn ($query) => $query->where('status', UserStatus::Active))->with('courier.courierProfile')->get()
            ->map(fn (CourierLogisticsAffiliation $item): array => ['id' => $item->courier_id, 'name' => trim(($item->courier->courierProfile?->first_name ?? '').' '.($item->courier->courierProfile?->last_name ?? '')) ?: $item->courier->email])->values();
    }

    private function truckOption(CompanyTruck $truck): array
    {
        return ['id' => $truck->id, 'plate_number' => $truck->plate_number, 'make' => $truck->make, 'model' => $truck->model, 'max_parcels' => $truck->max_parcels, 'revision' => $truck->revision];
    }

    private function idempotent(LinehaulTrip $trip, array $input, ?string $viewerHub): array
    {
        if (! hash_equals($trip->request_hash, $this->hash($input))) {
            throw FulfillmentException::conflict('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key belongs to another linehaul trip request.');
        }

        return $this->projection($this->load($trip), $viewerHub);
    }

    private function hash(array $input): string
    {
        ksort($input);

        return hash('sha256', json_encode($input, JSON_THROW_ON_ERROR));
    }

    private function load(LinehaulTrip $trip): LinehaulTrip
    {
        return $trip->fresh(['truck', 'driver.courierProfile', 'fromHub:id,name', 'toHub:id,name', 'shipments.shipment.parcel.waybill', 'shipments.hop', 'returnTrip']);
    }

    private function assertFeature(): void
    {
        if (! LinehaulService::enabled()) {
            throw FulfillmentException::conflict('LINEHAUL_DISABLED', 'Linehaul scheduling and departures are paused by the platform.');
        }
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
