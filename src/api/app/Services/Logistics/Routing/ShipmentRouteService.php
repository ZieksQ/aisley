<?php

namespace App\Services\Logistics\Routing;

use App\Enums\Logistics\HubRouteHopStatus;
use App\Enums\Logistics\HubRouteStatus;
use App\Enums\ShipmentStatus;
use App\Enums\UserStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\HubConnection;
use App\Models\HubServiceArea;
use App\Models\LogisticsHub;
use App\Models\Shipment;
use App\Models\ShipmentRoute;
use App\Models\ShipmentRouteHop;
use App\Models\Waybill;
use App\Services\Logistics\SortingPlanService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ShipmentRouteService
{
    public function __construct(private readonly GeoapifyHubMetrics $metrics, private readonly DirectedHubPathFinder $paths) {}

    public function snapshot(Waybill $waybill): ?ShipmentRoute
    {
        if (! config('hub-routing.enabled') || ! LinehaulService::enabled()) {
            return null;
        }

        return DB::transaction(fn () => $this->calculate($waybill));
    }

    private function calculate(Waybill $waybill, ?ShipmentRoute $route = null): ShipmentRoute
    {
        DB::table('permissions')->where('slug', 'platform-settings.manage')->lockForUpdate()->first();
        $postal = app(SortingPlanService::class)->normalizePostalCode((string) ($waybill->snapshot->payload['recipient']['postal_code'] ?? ''));
        $destinations = HubServiceArea::query()->where('postal_code', $postal)->where('is_active', true)
            ->whereHas('hub.organization.user', fn ($query) => $query->where('status', UserStatus::Active))->get();
        $destinationIds = $destinations->pluck('logistics_hub_id')->unique()->values()->all();
        $attributes = [
            'waybill_id' => $waybill->id, 'origin_hub_id' => $waybill->logistics_hub_id,
            'destination_hub_id' => count($destinationIds) === 1 ? $destinationIds[0] : null,
            'status' => HubRouteStatus::Unresolved, 'failure_code' => 'destination_unresolved', 'calculated_at' => now(), 'objective' => 'travel_handling_distance',
        ];
        if ($route === null) {
            $route = ShipmentRoute::create($attributes);
        } else {
            $route->update([...$attributes, 'graph_revision' => null, 'distance_meters' => null, 'duration_seconds' => null]);
        }
        if ($destinationIds === []) {
            return $this->result($route);
        }
        if (in_array($route->origin_hub_id, $destinationIds, true)) {
            $route->update(['destination_hub_id' => $route->origin_hub_id, 'status' => HubRouteStatus::Local, 'failure_code' => null, 'distance_meters' => 0, 'duration_seconds' => 0]);

            return $this->result($route);
        }
        $edges = HubConnection::query()->where('is_active', true)->where('receiver_accepted', true)
            ->whereHas('fromHub.organization.user', fn ($q) => $q->where('status', UserStatus::Active))
            ->whereHas('toHub.organization.user', fn ($q) => $q->where('status', UserStatus::Active))
            ->with(['fromHub.address', 'toHub.address'])->orderBy('id')->limit((int) config('hub-routing.max_edges') + 1)->get();
        $nodes = $edges->pluck('from_hub_id')->merge($edges->pluck('to_hub_id'))->unique();
        if ($edges->count() > config('hub-routing.max_edges') || $nodes->count() > config('hub-routing.max_nodes')) {
            return $this->fail($route, 'graph_limit');
        }
        $revision = $this->graphRevision($edges);
        $route->update(['graph_revision' => $revision]);
        // Measure only the origin-reachable graph. Missing metrics there cannot silently alter the optimum.
        $reachable = [$route->origin_hub_id => true];
        do {
            $before = count($reachable);
            foreach ($edges as $edge) {
                if (isset($reachable[$edge->from_hub_id])) {
                    $reachable[$edge->to_hub_id] = true;
                }
            }
        } while ($before !== count($reachable));
        $reachableDestinations = array_values(array_filter($destinationIds, fn (string $id): bool => isset($reachable[$id])));
        if ($reachableDestinations === []) {
            return $this->fail($route, 'no_path');
        }
        // Exclude dead ends and edges leaving any supported destination: with
        // nonnegative weights, passing one destination cannot improve the best result.
        $reachesDestination = array_fill_keys($reachableDestinations, true);
        do {
            $before = count($reachesDestination);
            foreach ($edges as $edge) {
                if (isset($reachesDestination[$edge->to_hub_id])) {
                    $reachesDestination[$edge->from_hub_id] = true;
                }
            }
        } while ($before !== count($reachesDestination));
        $eligible = $edges->filter(fn ($edge) => isset($reachable[$edge->from_hub_id], $reachesDestination[$edge->to_hub_id])
            && ! in_array($edge->from_hub_id, $reachableDestinations, true))->values();
        $metrics = $this->metrics->measure($eligible);
        $measured = [];
        foreach ($eligible as $edge) {
            $metric = $metrics[$edge->id];
            if ($metric['provider_status'] !== 'calculated') {
                return $this->fail($route, $metric['provider_status']);
            }
            $measured[] = [...$metric, 'hub_connection_id' => $edge->id, 'from_hub_id' => $edge->from_hub_id, 'to_hub_id' => $edge->to_hub_id];
        }
        $fresh = HubConnection::query()->where('is_active', true)->where('receiver_accepted', true)
            ->whereHas('fromHub.organization.user', fn ($q) => $q->where('status', UserStatus::Active))
            ->whereHas('toHub.organization.user', fn ($q) => $q->where('status', UserStatus::Active))
            ->with(['fromHub.address', 'toHub.address'])->orderBy('id')->limit((int) config('hub-routing.max_edges') + 1)->get();
        if ($revision !== $this->graphRevision($fresh)) {
            return $this->fail($route, 'graph_changed');
        }
        $best = $this->paths->findAny($route->origin_hub_id, $reachableDestinations, $measured);
        if ($best === null) {
            return $this->fail($route, 'no_path');
        }
        $path = $best['path'];
        if (count($path) > config('hub-routing.max_hops')) {
            return $this->fail($route, 'hop_limit');
        }
        foreach ($path as $index => $edge) {
            $route->hops()->create([...$edge, 'sequence' => $index + 1]);
        }
        $route->update(['destination_hub_id' => $best['destination_hub_id'], 'status' => HubRouteStatus::Planned, 'failure_code' => null, 'distance_meters' => array_sum(array_column($path, 'distance_meters')), 'duration_seconds' => array_sum(array_column($path, 'duration_seconds'))]);

        return $this->result($route);
    }

    /** Retry a held calculation at sorting, without rewriting committed hops. */
    public function retryHeldAtSorting(Shipment $shipment): void
    {
        if (! config('hub-routing.enabled') || ! LinehaulService::enabled()
            || $shipment->status !== ShipmentStatus::ReceivedAtHub
            || $shipment->current_hub_id !== $shipment->logistics_hub_id) {
            return;
        }
        $route = ShipmentRoute::where('shipment_id', $shipment->id)->lockForUpdate()->first();
        if ($route === null || ! in_array($route->status, [HubRouteStatus::Unresolved, HubRouteStatus::Unavailable], true)
            || $route->hops()->exists()) {
            return;
        }
        $this->calculate($shipment->parcel->waybill, $route);
        $shipment->unsetRelation('route');
    }

    public function attach(Waybill $waybill, Shipment $shipment): void
    {
        $route = ShipmentRoute::query()->where('waybill_id', $waybill->id)->lockForUpdate()->first();
        if ($route !== null && $route->shipment_id === null) {
            $route->update(['shipment_id' => $shipment->id]);
        }
    }

    public function nextHop(Shipment $shipment): ?ShipmentRouteHop
    {
        $route = $shipment->route;

        return $route?->hops()->where('status', '!=', HubRouteHopStatus::Arrived->value)->orderBy('sequence')->first();
    }

    public function assertFinalMile(Shipment $shipment): void
    {
        if ($shipment->route !== null && ($shipment->route->destination_hub_id !== $shipment->current_hub_id || ! in_array($shipment->route->status, [HubRouteStatus::Local, HubRouteStatus::Completed], true))) {
            throw FulfillmentException::conflict('ROUTE_FINAL_MILE_HELD', 'This parcel must complete its hub route before final-mile dispatch.');
        }
    }

    public function assertSortingLane(Shipment $shipment, string $laneId): void
    {
        if ($shipment->route === null || $shipment->route->status === HubRouteStatus::Local) {
            return;
        }
        $routing = app(SortingPlanService::class)->routeForShipment($shipment);
        if ($routing['lane']?->id !== $laneId) {
            throw FulfillmentException::conflict('ROUTE_LANE_CONFLICT', 'Use the active plan lane for this parcel destination.');
        }
    }

    public function projection(Shipment $shipment): ?array
    {
        $route = $shipment->route;
        if ($route === null) {
            return null;
        }
        $route->loadMissing(['originHub', 'destinationHub', 'hops']);
        $next = $this->nextHop($shipment);
        $summaries = LogisticsHub::query()->whereIn('id', $route->hops->pluck('from_hub_id')->merge($route->hops->pluck('to_hub_id'))->push($shipment->current_hub_id))->get()->keyBy('id');
        $summary = fn (?LogisticsHub $hub) => $hub ? ['id' => $hub->id, 'name' => $hub->name] : null;

        return [
            'id' => $route->id, 'status' => $route->status->value, 'failure_code' => $route->failure_code,
            'origin_hub' => $summary($route->originHub), 'destination_hub' => $summary($route->destinationHub),
            'current_hub' => $summary($summaries->get($shipment->current_hub_id)),
            'next_hub' => $summary($summaries->get($next?->to_hub_id)),
            'destination_type' => $next ? 'hub' : 'postal_code',
            'distance_meters' => $route->distance_meters, 'duration_seconds' => $route->duration_seconds,
            'metric_availability' => in_array($route->status, [HubRouteStatus::Unresolved, HubRouteStatus::Unavailable], true) ? 'unavailable' : ($route->status === HubRouteStatus::Local ? 'not_required' : 'calculated'),
            'attribution' => $route->hops->contains('provider', 'operator') ? 'Operator-recorded road measurements; Geoapify / OpenStreetMap where available' : 'Geoapify / OpenStreetMap',
            'hops' => $route->hops->map(fn ($hop) => [
                'id' => $hop->id, 'sequence' => $hop->sequence, 'status' => $hop->status->value, 'revision' => $hop->revision,
                'from_hub' => $summary($summaries->get($hop->from_hub_id)), 'to_hub' => $summary($summaries->get($hop->to_hub_id)),
                'distance_meters' => $hop->distance_meters, 'duration_seconds' => $hop->duration_seconds,
                'provider_status' => $hop->provider_status, 'departed_at' => $hop->departed_at?->toISOString(), 'arrived_at' => $hop->arrived_at?->toISOString(),
            ])->all(),
        ];
    }

    private function graphRevision(Collection $edges): string
    {
        return hash('sha256', $edges->map(fn ($edge) => implode(':', [$edge->id, $edge->from_hub_id, $edge->to_hub_id, $edge->revision, (int) $edge->is_active, $this->metrics->fingerprint($edge->fromHub->address), $this->metrics->fingerprint($edge->toHub->address)]))->implode('|'));
    }

    private function fail(ShipmentRoute $route, string $reason): ShipmentRoute
    {
        $route->update(['status' => HubRouteStatus::Unavailable, 'failure_code' => $reason]);

        return $this->result($route);
    }

    private function result(ShipmentRoute $route): ShipmentRoute
    {
        Log::info('hub_routing.calculation', ['status' => $route->status->value, 'failure_code' => $route->failure_code]);

        return $route;
    }
}
