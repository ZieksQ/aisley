<?php

namespace App\Services\Logistics\Routing;

use App\Enums\Logistics\HubRouteHopStatus;
use App\Enums\Logistics\LinehaulManifestStatus;
use App\Enums\ShipmentStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\LogisticsHub;
use App\Models\PlatformFeatureControl;
use App\Models\Shipment;
use App\Models\ShipmentRoute;
use App\Models\ShipmentRouteHop;
use App\Models\User;
use App\Services\Fulfillment\FulfillmentTransitionService;
use App\Services\Logistics\SortingPlanService;
use App\Services\PlatformFeatureControlService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LinehaulService
{
    public static function enabled(): bool
    {
        return app(PlatformFeatureControlService::class)->isEnabled(PlatformFeatureControl::LINEHAUL);
    }

    /**
     * Return the server-owned groups of sorted parcels that share the same
     * immediate next hop. The client never assembles this membership.
     *
     * @return array<int, array{next_hub_id: string, next_hub: string, references: array<int, string>}>
     */
    public function readyGroups(User $actor): array
    {
        $organization = $actor->logisticsOrganization()->with('hub')->first();
        if ($organization === null || $organization->hub === null) {
            throw FulfillmentException::notFound('LOGISTICS_CONTEXT_NOT_FOUND', 'The Logistics organization or operational hub is unavailable.');
        }

        $shipments = Shipment::query()
            ->where('current_logistics_organization_id', $organization->id)
            ->where('current_hub_id', $organization->hub->id)
            ->where('status', ShipmentStatus::SortedAtHub->value)
            ->whereHas('route', fn ($query) => $query->where('status', 'planned'))
            ->with(['route.hops', 'parcel.waybill.snapshot', 'sortingLane'])
            ->orderBy('received_at_hub_at')
            ->orderBy('id')
            ->limit(100)
            ->get();
        $groups = [];
        foreach ($shipments as $shipment) {
            $hop = $shipment->route?->hops->first(fn ($candidate) => $candidate->status === HubRouteHopStatus::Pending && $candidate->from_hub_id === $organization->hub->id);
            if ($hop === null || $shipment->parcel?->waybill?->reference === null) {
                continue;
            }
            $routing = app(SortingPlanService::class)->routeForShipment($shipment);
            if ($routing['reason'] !== 'matched' || $routing['lane']?->id !== $shipment->sorting_lane_id) {
                continue;
            }
            $groups[$hop->to_hub_id]['references'][] = $shipment->parcel->waybill->reference;
        }

        if ($groups === []) {
            return [];
        }
        $hubs = LogisticsHub::query()->whereIn('id', array_keys($groups))->get(['id', 'name'])->keyBy('id');

        return collect($groups)->map(function (array $group, string $hubId) use ($hubs): array {
            return [
                'next_hub_id' => $hubId,
                'next_hub' => $hubs->get($hubId)?->name ?? 'Unavailable hub',
                'references' => array_values($group['references']),
            ];
        })->values()->all();
    }

    public function departGroup(User $actor, string $nextHubId, string $id): array
    {
        $prior = DB::table('linehaul_manifests')->where('id', $id)->first();
        if ($prior !== null) {
            if ($prior->created_by !== $actor->id || $prior->to_hub_id !== $nextHubId) {
                throw FulfillmentException::conflict('IDEMPOTENCY_KEY_REUSED', 'This key belongs to another linehaul group.');
            }

            return $this->projection($prior);
        }
        $group = collect($this->readyGroups($actor))->firstWhere('next_hub_id', $nextHubId);
        if ($group === null) {
            throw FulfillmentException::conflict('LINEHAUL_NO_READY_PARCELS', 'No sorted parcels are ready for that next hub. Refresh the linehaul groups.');
        }

        return $this->depart($actor, $group['references'], $id);
    }

    public function depart(User $actor, array $references, string $id): array
    {
        sort($references);
        $hash = hash('sha256', json_encode($references));

        return DB::transaction(function () use ($actor, $references, $id, $hash): array {
            $hub = $actor->logisticsOrganization->hub;
            LogisticsHub::query()->whereKey($hub->id)->lockForUpdate()->firstOrFail();
            $prior = DB::table('linehaul_manifests')->where('id', $id)->first();
            if ($prior !== null) {
                if ($prior->created_by !== $actor->id || $prior->request_hash !== $hash) {
                    throw FulfillmentException::conflict('IDEMPOTENCY_KEY_REUSED', 'This key belongs to another manifest request.');
                }

                return $this->projection($prior);
            }
            if (! self::enabled()) {
                throw FulfillmentException::conflict('LINEHAUL_DISABLED', 'Linehaul departures are paused by the platform.');
            }
            $transitions = app(FulfillmentTransitionService::class);
            $items = [];
            $target = null;
            foreach ($references as $reference) {
                $record = $transitions->routeForLogistics($actor, $reference);
                $hop = collect($record['route']['hops'] ?? [])->first(fn ($hop) => $hop['status'] !== 'arrived');
                if ($record['status'] !== 'sorted_at_hub' || $hop === null || $hop['status'] !== 'pending' || $hop['from_hub']['id'] !== $hub->id) {
                    throw FulfillmentException::conflict('LINEHAUL_NOT_READY', 'Every parcel must be sorted for its next linehaul hop.');
                }
                $target ??= $hop['to_hub']['id'];
                if ($target !== $hop['to_hub']['id']) {
                    throw FulfillmentException::conflict('LINEHAUL_MIXED_DESTINATIONS', 'A manifest can contain only parcels going to the same next hub.');
                }
                $items[] = ['reference' => $reference, 'hop_id' => $hop['id'], 'expected_revision' => $record['revision'], 'expected_hop_revision' => $hop['revision']];
            }
            DB::table('linehaul_manifests')->insert([
                'id' => $id, 'from_hub_id' => $hub->id, 'to_hub_id' => $target, 'created_by' => $actor->id,
                'status' => LinehaulManifestStatus::InTransfer->value, 'items' => json_encode($items), 'request_hash' => $hash, 'created_at' => now(), 'updated_at' => now(),
            ]);
            foreach ($items as $item) {
                $transitions->transferAtHub($actor, $item, (string) Str::uuid(), false, $id);
                DB::table('shipment_route_hops')->where('id', $item['hop_id'])->update(['linehaul_manifest_id' => $id]);
            }

            return $this->projection(DB::table('linehaul_manifests')->where('id', $id)->first());
        }, 3);
    }

    public function arrive(User $actor, string $id): array
    {
        return DB::transaction(function () use ($actor, $id): array {
            $hub = $actor->logisticsOrganization->hub;
            LogisticsHub::query()->whereKey($hub->id)->lockForUpdate()->firstOrFail();
            $manifest = DB::table('linehaul_manifests')->where('id', $id)->where('to_hub_id', $hub->id)->lockForUpdate()->first();
            if ($manifest === null) {
                throw FulfillmentException::notFound();
            }
            if (LinehaulManifestStatus::from($manifest->status) === LinehaulManifestStatus::Received) {
                return $this->projection($manifest);
            }
            foreach (json_decode($manifest->items, true) as $item) {
                $hop = ShipmentRouteHop::findOrFail($item['hop_id']);
                $shipment = Shipment::findOrFail(ShipmentRoute::findOrFail($hop->shipment_route_id)->shipment_id);
                app(FulfillmentTransitionService::class)->transferAtHub($actor, [
                    ...$item, 'expected_revision' => $shipment->revision, 'expected_hop_revision' => $hop->revision,
                ], (string) Str::uuid(), true, $id);
            }
            DB::table('linehaul_manifests')->where('id', $id)->update(['status' => LinehaulManifestStatus::Received->value, 'received_at' => now(), 'updated_at' => now()]);

            return $this->projection(DB::table('linehaul_manifests')->where('id', $id)->first());
        }, 3);
    }

    public function projection(object $manifest): array
    {
        return ['id' => $manifest->id, 'status' => $manifest->status,
            'from_hub' => LogisticsHub::find($manifest->from_hub_id)?->name,
            'to_hub' => LogisticsHub::find($manifest->to_hub_id)?->name,
            'references' => array_column(json_decode($manifest->items, true), 'reference'),
            'created_at' => $manifest->created_at, 'received_at' => $manifest->received_at];
    }
}
