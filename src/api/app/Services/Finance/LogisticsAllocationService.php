<?php

namespace App\Services\Finance;

use App\Enums\ShippingRoutePricingStatus;
use App\Models\FinancialHold;
use App\Models\LinehaulTripShipment;
use App\Models\LogisticsServiceAllocation;
use App\Models\Order;
use App\Models\Shipment;

class LogisticsAllocationService
{
    /** @return array{held: bool, allocations: list<array<string, mixed>>} */
    public function allocate(Order $order, Shipment $shipment, int $pool): array
    {
        if ($pool === 0) {
            return ['held' => false, 'allocations' => []];
        }
        $order->loadMissing('pricingSnapshot');
        $snapshot = $order->pricingSnapshot;
        if ($snapshot === null || $snapshot->shipping_route_status === ShippingRoutePricingStatus::Unplanned) {
            return $this->hold($order, 'UNPLANNED_ROUTE_RECONCILIATION_REQUIRED');
        }
        $charges = collect($snapshot->logistics_charge_inputs ?? [])->values();
        $quotedTotal = $charges->sum('quoted_charge_cents');
        if ($charges->isEmpty() || $quotedTotal < 1) {
            return $this->hold($order, 'LOGISTICS_QUOTED_CHARGES_MISSING');
        }

        $shipment->loadMissing(['route.hops', 'organization', 'currentHub.organization']);
        $route = $shipment->route;
        if ($route === null || $shipment->logistics_organization_id !== $snapshot->selected_logistics_organization_id) {
            return $this->hold($order, 'LOGISTICS_EVIDENCE_MISSING');
        }
        $hops = $route->hops->keyBy('sequence');
        $prepared = [];
        foreach ($charges as $index => $charge) {
            $hop = null;
            if ($charge['service_type'] === 'first_mile') {
                if ($shipment->logistics_organization_id !== $charge['organization_id']) {
                    return $this->hold($order, 'LOGISTICS_EVIDENCE_MISSING');
                }
            } elseif ($charge['service_type'] === 'last_mile') {
                if ($shipment->current_logistics_organization_id !== $charge['organization_id']) {
                    return $this->hold($order, 'LOGISTICS_EVIDENCE_MISSING');
                }
            } elseif ($charge['service_type'] === 'linehaul') {
                $hop = $hops->get((int) $charge['hop_sequence']);
                $tripLink = $hop === null ? null : LinehaulTripShipment::query()
                    ->where('shipment_route_hop_id', $hop->id)
                    ->whereHas('trip', fn ($query) => $query->whereNotNull('departed_at'))
                    ->with('trip')->latest('created_at')->first();
                if ($hop?->arrived_at === null || $tripLink?->trip?->owner_logistics_organization_id !== $charge['organization_id']) {
                    return $this->hold($order, 'LINEHAUL_EVIDENCE_MISSING');
                }
            }
            $prepared[] = [
                'organization_id' => $charge['organization_id'],
                'service_type' => $charge['service_type'],
                'hop_id' => $hop?->id,
                'distance_meters' => $hop === null ? null : (int) round((float) $hop->distance_meters),
                'quoted_charge_cents' => (int) $charge['quoted_charge_cents'],
                'stable_index' => $index,
            ];
        }
        $prepared = $this->distribute($prepared, $pool);

        return ['held' => false, 'allocations' => array_map(fn (array $entry) => collect($entry)->except('stable_index')->all(), $prepared)];
    }

    /** @param list<array<string, mixed>> $allocations @return list<array<string, mixed>> */
    public function distribute(array $allocations, int $pool): array
    {
        $quotedTotal = collect($allocations)->sum('quoted_charge_cents');
        if ($quotedTotal < 1) {
            throw new \InvalidArgumentException('Quoted route charges must be positive.');
        }
        foreach ($allocations as &$allocation) {
            $numerator = $pool * (int) $allocation['quoted_charge_cents'];
            $allocation['amount_cents'] = intdiv($numerator, $quotedTotal);
            $allocation['remainder'] = $numerator % $quotedTotal;
        }
        unset($allocation);
        $distributed = collect($allocations)->sum('amount_cents');
        usort($allocations, fn (array $left, array $right) => ($right['remainder'] <=> $left['remainder']) ?: ($left['stable_index'] <=> $right['stable_index']));
        for ($index = 0; $index < $pool - $distributed; $index++) {
            $allocations[$index]['amount_cents']++;
        }
        usort($allocations, fn (array $left, array $right) => $left['stable_index'] <=> $right['stable_index']);

        return array_map(fn (array $entry) => collect($entry)->except('remainder')->all(), $allocations);
    }

    /** @param list<array<string, mixed>> $allocations */
    public function commit(Order $order, array $allocations): void
    {
        foreach ($allocations as $allocation) {
            LogisticsServiceAllocation::query()->firstOrCreate([
                'order_id' => $order->id,
                'logistics_organization_id' => $allocation['organization_id'],
                'service_type' => $allocation['service_type'],
                'shipment_route_hop_id' => $allocation['hop_id'],
            ], [
                'distance_meters' => $allocation['distance_meters'],
                'quoted_charge_cents' => $allocation['quoted_charge_cents'],
                'amount_cents' => $allocation['amount_cents'],
                'status' => 'committed',
                'committed_at' => now(),
            ]);
        }
    }

    /** @return array{held: true, allocations: array{}} */
    private function hold(Order $order, string $reason): array
    {
        FinancialHold::query()->firstOrCreate(
            ['order_id' => $order->id, 'reason_code' => $reason, 'released_at' => null],
            ['placed_at' => now(), 'notes' => 'Automatic hold: route pricing or completed Logistics evidence requires Admin reconciliation.'],
        );

        return ['held' => true, 'allocations' => []];
    }
}
