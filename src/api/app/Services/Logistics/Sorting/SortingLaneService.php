<?php

namespace App\Services\Logistics\Sorting;

use App\Enums\Logistics\SortingLaneState;
use App\Enums\Logistics\SortingLaneType;
use App\Enums\Logistics\SortingSessionStatus;
use App\Enums\ShipmentStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\LogisticsOrganization;
use App\Models\Shipment;
use App\Models\SortingLane;
use App\Models\SortingSessionItem;
use App\Models\User;
use App\Services\Logistics\SortingPlanService;
use Illuminate\Support\Facades\DB;
use Picqer\Barcode\BarcodeGeneratorSVG;
use Symfony\Component\HttpFoundation\Response;

class SortingLaneService
{
    public function __construct(private readonly SortingPlanService $sortingPlans) {}

    public function createLane(User $logistics, array $input): SortingLane
    {
        $org = $this->organization($logistics);
        $code = mb_strtoupper(trim((string) $input['code']));
        if ($this->laneCodeExists($org, $code)) {
            throw FulfillmentException::invalid('SORT_LANE_CODE_TAKEN', 'A sorting lane already uses this code.', 'code');
        }
        $position = (int) ($input['position'] ?? ((int) SortingLane::query()->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id)->max('position') + 1));

        return SortingLane::create([
            'logistics_organization_id' => $org->id,
            'logistics_hub_id' => $org->hub->id,
            'created_by_logistics_id' => $logistics->id,
            'code' => $code,
            'name' => trim((string) $input['name']),
            'type' => SortingLaneType::from((string) $input['type']),
            'is_active' => true,
            'position' => $position,
            'revision' => 1,
        ]);
    }

    public function updateLane(User $logistics, SortingLane $lane, array $input): SortingLane
    {
        $org = $this->organization($logistics);

        return DB::transaction(function () use ($logistics, $lane, $input, $org): SortingLane {
            SortingLocks::hub($org->hub->id);
            $owned = $this->ownedLane($org, $lane->id, true);
            if ($owned->revision !== (int) $input['expected_revision']) {
                throw FulfillmentException::conflict('SORT_LANE_REVISION_CONFLICT', 'The sorting lane changed. Refresh before editing it.');
            }
            $code = array_key_exists('code', $input) ? mb_strtoupper(trim((string) $input['code'])) : $owned->code;
            if ($code !== $owned->code && $this->laneCodeExists($org, $code, $owned->id)) {
                throw FulfillmentException::invalid('SORT_LANE_CODE_TAKEN', 'A sorting lane already uses this code.', 'code');
            }
            $nextType = array_key_exists('type', $input) ? SortingLaneType::from((string) $input['type']) : $owned->type;
            $nextActive = array_key_exists('is_active', $input) ? (bool) $input['is_active'] : $owned->is_active;
            $referencedByOpenSession = SortingSessionItem::query()->where('sorting_lane_id', $owned->id)
                ->whereHas('session', fn ($query) => $query->where('status', SortingSessionStatus::Open->value))->exists();
            $hasStagedParcels = Shipment::query()->where('sorting_lane_id', $owned->id)->whereIn('status', [
                ShipmentStatus::SortedAtHub->value, ShipmentStatus::DispatchedFromHub->value,
                ShipmentStatus::DeliveryAssigned->value, ShipmentStatus::DeliveryAccepted->value,
            ])->exists();
            if (($referencedByOpenSession || $hasStagedParcels) && ((! $nextActive) || $nextType !== $owned->type)) {
                throw FulfillmentException::conflict('SORT_LANE_IN_USE', 'Reconcile the open session and move staged parcels or confirm Courier collection before changing this lane type or deactivating it.');
            }

            $state = isset($input['operational_state']) ? SortingLaneState::from($input['operational_state']) : $owned->operational_state;
            if ($state !== SortingLaneState::Open && blank($input['blocking_reason'] ?? $owned->blocking_reason)) {
                throw FulfillmentException::invalid('SORT_LANE_REASON_REQUIRED', 'Pause and Hold require a reason.', 'blocking_reason');
            }
            $designated = $this->sortingPlans->exceptionLaneForContext($org->id, $org->hub->id);
            if ($designated?->id === $owned->id && (! $nextActive || $nextType !== SortingLaneType::Exception || $state !== SortingLaneState::Open)) {
                throw FulfillmentException::conflict('SORT_EXCEPTION_LANE_PROTECTED', 'The designated exception lane must remain active and open.');
            }
            $owned->update([
                'operational_state' => $state,
                'blocking_reason' => $state === SortingLaneState::Open ? null : trim($input['blocking_reason'] ?? $owned->blocking_reason),
                'state_changed_by' => $logistics->id,
                'state_changed_at' => now(),
                'code' => $code,
                'name' => array_key_exists('name', $input) ? trim((string) $input['name']) : $owned->name,
                'type' => $nextType,
                'is_active' => $nextActive,
                'position' => (int) ($input['position'] ?? $owned->position),
                'revision' => $owned->revision + 1,
            ]);

            return $owned->fresh();
        }, 3);
    }

    public function labelResponse(User $logistics, SortingLane $lane): Response
    {
        $org = $this->organization($logistics);
        $owned = $this->ownedLane($org, $lane->id);
        $payload = 'AISLEY:SORT-LANE:1:'.$owned->id;
        $barcode = (new BarcodeGeneratorSVG)->getBarcode($payload, BarcodeGeneratorSVG::TYPE_CODE_128, 2, 60);
        $code = htmlspecialchars($owned->code, ENT_QUOTES | ENT_XML1, 'UTF-8');
        $name = htmlspecialchars($owned->name, ENT_QUOTES | ENT_XML1, 'UTF-8');
        $image = base64_encode($barcode);
        $svg = <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300" role="img" aria-labelledby="title desc">
  <title id="title">Sorting lane {$code}</title>
  <desc id="desc">Printable Code 128 label for {$name}</desc>
  <rect width="600" height="300" fill="#fff"/>
  <text x="300" y="55" text-anchor="middle" font-family="sans-serif" font-size="34" font-weight="700" fill="#111">{$code}</text>
  <text x="300" y="88" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#333">{$name}</text>
  <image x="45" y="112" width="510" height="105" href="data:image/svg+xml;base64,{$image}" preserveAspectRatio="xMidYMid meet"/>
  <text x="300" y="252" text-anchor="middle" font-family="monospace" font-size="12" fill="#444">{$payload}</text>
</svg>
SVG;

        return response($svg, 200, [
            'Content-Type' => 'image/svg+xml; charset=UTF-8',
            'Content-Disposition' => 'inline; filename="sorting-lane-'.$owned->code.'.svg"',
            'Cache-Control' => 'private, no-store, max-age=0',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function organization(User $logistics): LogisticsOrganization
    {
        $org = $logistics->logisticsOrganization()->with('hub')->first();
        if ($org === null || $org->hub === null) {
            throw FulfillmentException::notFound('LOGISTICS_CONTEXT_NOT_FOUND', 'The Logistics organization or operational hub is unavailable.');
        }

        return $org;
    }

    private function ownedLane(LogisticsOrganization $org, string $laneId, bool $lock = false): SortingLane
    {
        $query = SortingLane::query()->whereKey($laneId)->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id);
        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->first() ?? throw FulfillmentException::notFound('SORT_LANE_NOT_FOUND', 'This sorting lane is unavailable.');
    }

    private function laneCodeExists(LogisticsOrganization $org, string $code, ?string $except = null): bool
    {
        return SortingLane::query()->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id)
            ->where('code', $code)->when($except, fn ($query) => $query->whereKeyNot($except))->exists();
    }
}
