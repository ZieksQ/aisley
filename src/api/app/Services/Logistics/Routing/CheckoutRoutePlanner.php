<?php

namespace App\Services\Logistics\Routing;

use App\Enums\Logistics\SortingDestinationType;
use App\Enums\Logistics\SortingLaneType;
use App\Enums\ShippingRoutePricingStatus;
use App\Enums\UserStatus;
use App\Models\HubConnection;
use App\Models\HubServiceArea;
use App\Models\LogisticsHub;
use App\Models\SortingPlan;
use App\Services\Logistics\SortingPlanService;

class CheckoutRoutePlanner
{
    public function __construct(
        private readonly GeoapifyHubMetrics $metrics,
        private readonly DirectedHubPathFinder $paths,
        private readonly SortingPlanService $sortingPlans,
    ) {}

    /** @return array<string, mixed> */
    public function plan(LogisticsHub $origin, string $postalCode): array
    {
        if (! config('hub-routing.enabled') || ! LinehaulService::enabled()) {
            return $this->unplanned('routing_disabled', $origin, $this->sortingPlans->normalizePostalCode($postalCode));
        }
        $postal = $this->sortingPlans->normalizePostalCode($postalCode);
        if ($postal === null) {
            return $this->unplanned('postal_code_invalid', $origin, null);
        }
        $destinations = HubServiceArea::query()->where('postal_code', $postal)->where('is_active', true)
            ->whereHas('hub.organization.user', fn ($query) => $query->where('status', UserStatus::Active))
            ->with('hub.organization:id,user_id,business_name')->get();
        $destinationIds = $destinations->pluck('logistics_hub_id')->unique()->values()->all();
        if ($destinationIds === []) {
            return $this->unplanned('destination_uncovered', $origin, $postal);
        }

        $plans = SortingPlan::query()->where('is_active', true)->with('lanes.lane')->get()->keyBy('logistics_hub_id');
        $destinationsWithFinalMile = collect($destinationIds)->filter(function (string $hubId) use ($plans, $postal): bool {
            $plan = $plans->get($hubId);
            $mapping = $plan?->lanes->first(fn ($lane) => $lane->destination_type === SortingDestinationType::PostalCode && $lane->postal_code === $postal);

            return $mapping?->lane?->is_active === true && $mapping->lane->type === SortingLaneType::Standard;
        })->values()->all();
        if ($destinationsWithFinalMile === []) {
            return $this->unplanned('destination_sort_plan_unavailable', $origin, $postal);
        }
        if (in_array($origin->id, $destinationsWithFinalMile, true)) {
            return $this->snapshot(ShippingRoutePricingStatus::Local, $origin, $origin, [], $plans, $postal);
        }

        $edges = HubConnection::query()->where('is_active', true)->where('receiver_accepted', true)
            ->whereHas('fromHub.organization.user', fn ($query) => $query->where('status', UserStatus::Active))
            ->whereHas('toHub.organization.user', fn ($query) => $query->where('status', UserStatus::Active))
            ->with(['fromHub.address', 'fromHub.organization', 'toHub.address', 'toHub.organization'])
            ->orderBy('id')->limit((int) config('hub-routing.max_edges') + 1)->get();
        $edges = $edges->filter(function (HubConnection $edge) use ($plans): bool {
            $plan = $plans->get($edge->from_hub_id);
            $mapping = $plan?->lanes->first(fn ($lane) => $lane->destination_type === SortingDestinationType::Hub && $lane->destination_hub_id === $edge->to_hub_id);

            return $mapping?->lane?->is_active === true && $mapping->lane->type === SortingLaneType::Standard;
        })->values();
        $nodes = $edges->pluck('from_hub_id')->merge($edges->pluck('to_hub_id'))->unique();
        if ($edges->count() > config('hub-routing.max_edges') || $nodes->count() > config('hub-routing.max_nodes')) {
            return $this->unplanned('graph_limit', $origin, $postal);
        }

        $reachable = [$origin->id => true];
        do {
            $before = count($reachable);
            foreach ($edges as $edge) {
                if (isset($reachable[$edge->from_hub_id])) {
                    $reachable[$edge->to_hub_id] = true;
                }
            }
        } while ($before !== count($reachable));
        $reachableDestinations = array_values(array_filter(
            $destinationsWithFinalMile,
            fn (string $hubId): bool => isset($reachable[$hubId]),
        ));
        if ($reachableDestinations === []) {
            return $this->unplanned('complete_sort_plan_route_unavailable', $origin, $postal);
        }

        $reachesDestination = array_fill_keys($reachableDestinations, true);
        do {
            $before = count($reachesDestination);
            foreach ($edges as $edge) {
                if (isset($reachesDestination[$edge->to_hub_id])) {
                    $reachesDestination[$edge->from_hub_id] = true;
                }
            }
        } while ($before !== count($reachesDestination));
        $eligible = $edges->filter(fn (HubConnection $edge): bool => isset(
            $reachable[$edge->from_hub_id],
            $reachesDestination[$edge->to_hub_id],
        ) && ! in_array($edge->from_hub_id, $reachableDestinations, true))->values();

        $metrics = $this->metrics->measure($eligible);
        $measured = [];
        foreach ($eligible as $edge) {
            $metric = $metrics[$edge->id] ?? ['provider_status' => 'metric_unavailable'];
            if (($metric['provider_status'] ?? null) !== 'calculated') {
                return $this->unplanned((string) $metric['provider_status'], $origin, $postal);
            }
            $measured[] = [
                ...$metric,
                'hub_connection_id' => $edge->id,
                'from_hub_id' => $edge->from_hub_id,
                'to_hub_id' => $edge->to_hub_id,
                'from_organization_id' => $edge->fromHub->logistics_organization_id,
                'to_organization_id' => $edge->toHub->logistics_organization_id,
                'connection_revision' => $edge->revision,
            ];
        }
        $best = $this->paths->findAny($origin->id, $reachableDestinations, $measured);
        if ($best === null || count($best['path']) > config('hub-routing.max_hops')) {
            return $this->unplanned('complete_sort_plan_route_unavailable', $origin, $postal);
        }
        $destination = LogisticsHub::query()->with('organization')->findOrFail($best['destination_hub_id']);

        return $this->snapshot(ShippingRoutePricingStatus::Planned, $origin, $destination, $best['path'], $plans, $postal);
    }

    /** @param array<int, array<string, mixed>> $hops */
    private function snapshot(ShippingRoutePricingStatus $status, LogisticsHub $origin, LogisticsHub $destination, array $hops, $plans, string $postal): array
    {
        $hubIds = collect($hops)->pluck('from_hub_id')->merge(collect($hops)->pluck('to_hub_id'))->push($origin->id)->push($destination->id)->unique();
        $planSnapshots = $hubIds->map(function (string $hubId) use ($plans): array {
            $plan = $plans->get($hubId);

            return ['hub_id' => $hubId, 'plan_id' => $plan?->id, 'revision' => $plan?->revision];
        })->values()->all();

        return [
            'status' => $status->value,
            'failure_code' => null,
            'origin_hub_id' => $origin->id,
            'origin_organization_id' => $origin->logistics_organization_id,
            'destination_hub_id' => $destination->id,
            'destination_organization_id' => $destination->logistics_organization_id,
            'destination_postal_code' => $postal,
            'objective' => 'travel_handling_distance',
            'graph_revision' => hash('sha256', json_encode([$planSnapshots, collect($hops)->map(fn ($hop) => [$hop['hub_connection_id'], $hop['connection_revision']])->all()], JSON_THROW_ON_ERROR)),
            'distance_meters' => (int) round(collect($hops)->sum('distance_meters')),
            'duration_seconds' => (int) round(collect($hops)->sum('duration_seconds')),
            'sort_plans' => $planSnapshots,
            'hops' => array_values($hops),
            'calculated_at' => now()->toISOString(),
        ];
    }

    /** @return array<string, mixed> */
    private function unplanned(string $reason, LogisticsHub $origin, ?string $postal): array
    {
        return [
            'status' => ShippingRoutePricingStatus::Unplanned->value,
            'failure_code' => $reason,
            'origin_hub_id' => $origin->id,
            'origin_organization_id' => $origin->logistics_organization_id,
            'destination_hub_id' => null,
            'destination_organization_id' => null,
            'destination_postal_code' => $postal,
            'objective' => 'travel_handling_distance',
            'graph_revision' => null,
            'distance_meters' => null,
            'duration_seconds' => null,
            'sort_plans' => [],
            'hops' => [],
            'calculated_at' => now()->toISOString(),
        ];
    }
}
