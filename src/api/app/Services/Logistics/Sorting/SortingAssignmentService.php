<?php

namespace App\Services\Logistics\Sorting;

use App\Enums\Logistics\SortingLaneState;
use App\Enums\Logistics\SortingLaneType;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\Shipment;
use App\Models\SortingLane;
use App\Services\Logistics\Routing\ShipmentRouteService;

class SortingAssignmentService
{
    public function snapshot(Shipment $shipment, SortingLane $lane, array $routing, string $actorId): array
    {
        $hop = app(ShipmentRouteService::class)->nextHop($shipment);
        $version = $routing['plan']?->activeVersion;

        return [
            'legacy_reconstructed' => false, 'version_id' => $version?->id,
            'version_number' => $version?->number, 'plan_id' => $routing['plan']?->id,
            'plan_name' => $version?->name, 'assigned_by' => $actorId, 'assigned_at' => now()->toISOString(),
            'lane' => ['id' => $lane->id, 'code' => $lane->code, 'name' => $lane->name, 'revision' => $lane->revision],
            'destination_type' => $hop ? 'hub' : 'postal_code',
            'postal_code' => $routing['postal_code'] ?? $shipment->parcel?->waybill?->snapshot?->payload['recipient']['postal_code'] ?? null,
            'hop_id' => $hop?->id, 'connection_id' => $hop?->hub_connection_id,
            'next_hub_id' => $hop?->to_hub_id,
            'next_hub_name' => $hop?->toHub?->name,
        ];
    }

    public function assertOpen(Shipment $shipment): void
    {
        if ($shipment->sorting_lane_id === null) {
            return;
        } // Legacy assignment compatibility.
        $lane = SortingLane::query()->whereKey($shipment->sorting_lane_id)->where('logistics_hub_id', $shipment->current_hub_id)
            ->where('logistics_organization_id', $shipment->current_logistics_organization_id)->lockForUpdate()->first();
        if ($lane === null || ! $lane->is_active || $lane->type !== SortingLaneType::Standard || $lane->operational_state !== SortingLaneState::Open) {
            throw FulfillmentException::conflict('SORT_LANE_BLOCKED', $lane?->blocking_reason ?? 'The physical source lane is unavailable. Resume the lane before dispatch or hub pickup.');
        }
    }

    /** Frozen labels and live operational metadata are deliberately separate. */
    public function projection(Shipment $shipment): ?array
    {
        if ($shipment->sorting_lane_id === null) {
            return null;
        }
        $lane = $shipment->sortingLane;
        $frozen = $shipment->sorting_assignment['lane'] ?? ['id' => $shipment->sorting_lane_id, 'code' => null, 'name' => null];

        return [...$frozen, 'revision' => $lane?->revision, 'operational_state' => $lane?->operational_state?->value,
            'blocking_reason' => $lane?->blocking_reason, 'legacy_reconstructed' => $shipment->sorting_assignment['legacy_reconstructed'] ?? true];
    }
}
