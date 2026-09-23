<?php

namespace App\Services\Finance;

use App\Models\FinancialHold;
use App\Models\LinehaulTripShipment;
use App\Models\LogisticsServiceAllocation;
use App\Models\Order;
use App\Models\Shipment;

class LogisticsAllocationService
{
    /** @return array{held: bool, allocations: list<array{organization_id: string, service_type: string, hop_id: string|null, distance_meters: int|null, amount_cents: int}>} */
    public function allocate(Order $order, Shipment $shipment, int $pool): array
    {
        if ($pool === 0) {
            return ['held' => false, 'allocations' => []];
        }
        $shipment->loadMissing(['route.hops', 'organization', 'currentHub.organization']);
        $route = $shipment->route;
        $firstOrg = $shipment->logistics_organization_id;
        $lastOrg = $shipment->current_logistics_organization_id;
        if ($firstOrg === null || $lastOrg === null || $route === null) {
            return $this->hold($order, 'LOGISTICS_EVIDENCE_MISSING');
        }
        if ($route->origin_hub_id === $route->destination_hub_id && $firstOrg === $lastOrg) {
            return ['held' => false, 'allocations' => [[
                'organization_id' => $firstOrg, 'service_type' => 'same_hub', 'hop_id' => null,
                'distance_meters' => null, 'amount_cents' => $pool,
            ]]];
        }
        if ($route->hops->isEmpty()) {
            return $this->hold($order, 'LINEHAUL_EVIDENCE_MISSING');
        }

        $completed = [];
        foreach ($route->hops as $hop) {
            $tripLink = LinehaulTripShipment::query()->where('shipment_route_hop_id', $hop->id)
                ->whereHas('trip', fn ($query) => $query->whereNotNull('departed_at'))
                ->with('trip')->latest('created_at')->first();
            $distance = (int) round((float) $hop->distance_meters);
            if ($hop->arrived_at === null || $distance < 1 || $tripLink?->trip?->owner_logistics_organization_id === null) {
                return $this->hold($order, 'LINEHAUL_EVIDENCE_MISSING');
            }
            $completed[] = ['hop' => $hop, 'organization_id' => $tripLink->trip->owner_logistics_organization_id, 'distance' => $distance];
        }

        $first = intdiv($pool * 25, 100);
        $last = intdiv($pool * 35, 100);
        $linehaul = $pool - $first - $last;
        $allocations = [
            ['organization_id' => $firstOrg, 'service_type' => 'first_mile', 'hop_id' => null, 'distance_meters' => null, 'amount_cents' => $first],
            ['organization_id' => $lastOrg, 'service_type' => 'last_mile', 'hop_id' => null, 'distance_meters' => null, 'amount_cents' => $last],
        ];
        $distanceTotal = collect($completed)->sum('distance');
        $distributed = 0;
        $shares = collect($completed)->map(function (array $leg) use ($linehaul, $distanceTotal, &$distributed): array {
            $numerator = $linehaul * $leg['distance'];
            $amount = intdiv($numerator, $distanceTotal);
            $distributed += $amount;

            return [...$leg, 'amount_cents' => $amount, 'remainder' => $numerator % $distanceTotal];
        })->sort(function (array $left, array $right): int {
            return ($right['remainder'] <=> $left['remainder'])
                ?: ($left['organization_id'] <=> $right['organization_id'])
                ?: ($left['hop']->id <=> $right['hop']->id);
        })->values();
        for ($index = 0; $index < $linehaul - $distributed; $index++) {
            $shares[$index]['amount_cents']++;
        }
        foreach ($shares as $share) {
            $allocations[] = [
                'organization_id' => $share['organization_id'], 'service_type' => 'linehaul',
                'hop_id' => $share['hop']->id, 'distance_meters' => $share['distance'], 'amount_cents' => $share['amount_cents'],
            ];
        }

        return ['held' => false, 'allocations' => $allocations];
    }

    /** @param list<array<string, mixed>> $allocations */
    public function commit(Order $order, array $allocations): void
    {
        foreach ($allocations as $allocation) {
            LogisticsServiceAllocation::query()->firstOrCreate([
                'order_id' => $order->id, 'logistics_organization_id' => $allocation['organization_id'],
                'service_type' => $allocation['service_type'], 'shipment_route_hop_id' => $allocation['hop_id'],
            ], ['distance_meters' => $allocation['distance_meters'], 'amount_cents' => $allocation['amount_cents'], 'status' => 'committed', 'committed_at' => now()]);
        }
    }

    /** @return array{held: true, allocations: array{}} */
    private function hold(Order $order, string $reason): array
    {
        FinancialHold::query()->firstOrCreate(
            ['order_id' => $order->id, 'reason_code' => $reason, 'released_at' => null],
            ['placed_at' => now(), 'notes' => 'Automatic hold: Logistics service allocation evidence is incomplete.'],
        );

        return ['held' => true, 'allocations' => []];
    }
}
