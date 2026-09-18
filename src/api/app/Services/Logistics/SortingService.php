<?php

namespace App\Services\Logistics;

use App\Enums\Logistics\HubRouteStatus;
use App\Enums\Logistics\SortingExceptionCode;
use App\Enums\Logistics\SortingItemStatus;
use App\Enums\Logistics\SortingLaneType;
use App\Enums\Logistics\SortingScanOutcome;
use App\Enums\Logistics\SortingSessionStatus;
use App\Enums\ShipmentStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\LogisticsHub;
use App\Models\LogisticsOrganization;
use App\Models\Shipment;
use App\Models\SortingLane;
use App\Models\SortingPlan;
use App\Models\SortingScan;
use App\Models\SortingSession;
use App\Models\SortingSessionItem;
use App\Models\User;
use App\Services\Fulfillment\FulfillmentTransitionService;
use App\Services\Logistics\Routing\ShipmentRouteService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Picqer\Barcode\BarcodeGeneratorSVG;
use Symfony\Component\HttpFoundation\Response;

class SortingService
{
    private const SESSION_LIMIT = 100;

    public function __construct(
        private readonly FulfillmentTransitionService $fulfillment,
        private readonly SortingPlanService $sortingPlans,
    ) {}

    /** @return array<string, mixed> */
    public function overview(User $logistics): array
    {
        $org = $this->organization($logistics);
        $session = SortingSession::query()
            ->where('logistics_organization_id', $org->id)
            ->where('logistics_hub_id', $org->hub->id)
            ->where('status', SortingSessionStatus::Open->value)
            ->with($this->sessionRelations())
            ->first();
        $assigned = $session?->items->pluck('shipment_id')->all() ?? [];
        $waiting = Shipment::query()
            ->where('current_logistics_organization_id', $org->id)
            ->where('current_hub_id', $org->hub->id)
            ->where('status', ShipmentStatus::ReceivedAtHub->value)
            ->when($assigned !== [], fn ($query) => $query->whereNotIn('id', $assigned))
            ->count();

        return [
            'context' => ['organization_id' => $org->id, 'hub_id' => $org->hub->id, 'hub_name' => $org->hub->name],
            'lanes' => $this->lanes($org),
            'automatic_sorting' => $this->automaticSortingProjection($org),
            'session' => $session ? $this->sessionProjection($session) : null,
            'waiting_received' => $waiting,
            'session_limit' => self::SESSION_LIMIT,
        ];
    }

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

        return DB::transaction(function () use ($lane, $input, $org): SortingLane {
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

            $owned->update([
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

    public function openSession(User $logistics, string $idempotencyKey): SortingSession
    {
        $org = $this->organization($logistics);
        $requestHash = hash('sha256', 'sorting-session-v1|'.$org->id.'|'.$org->hub->id);

        return DB::transaction(function () use ($logistics, $org, $idempotencyKey, $requestHash): SortingSession {
            LogisticsHub::query()->whereKey($org->hub->id)->lockForUpdate()->firstOrFail();
            $prior = SortingSession::query()->where('opened_by_logistics_id', $logistics->id)->where('idempotency_key', $idempotencyKey)->lockForUpdate()->first();
            if ($prior !== null) {
                if (! hash_equals($prior->request_hash, $requestHash)) {
                    throw FulfillmentException::conflict('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for another sorting session.');
                }

                return $this->loadSession($prior);
            }
            if (SortingSession::query()->where('open_key', $org->id.':'.$org->hub->id)->exists()) {
                throw FulfillmentException::conflict('SORT_SESSION_ALREADY_OPEN', 'This hub already has an open sorting session.');
            }
            if (! SortingLane::query()->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id)->where('type', SortingLaneType::Standard->value)->where('is_active', true)->exists()) {
                throw FulfillmentException::invalid('SORT_STANDARD_LANE_REQUIRED', 'Create an active standard lane before starting a sorting session.');
            }
            $shipments = Shipment::query()
                ->where('current_logistics_organization_id', $org->id)
                ->where('current_hub_id', $org->hub->id)
                ->where('status', ShipmentStatus::ReceivedAtHub->value)
                ->whereDoesntHave('sortingItems', fn ($query) => $query->whereHas('session', fn ($session) => $session->where('status', SortingSessionStatus::Open->value)->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id)))
                ->orderByRaw('COALESCE(received_at_hub_at, created_at)')->orderBy('id')->limit(self::SESSION_LIMIT)->lockForUpdate()->get();
            if ($shipments->isEmpty()) {
                throw FulfillmentException::invalid('SORT_SESSION_EMPTY', 'No received parcels are waiting for sorting.');
            }

            $session = SortingSession::create([
                'logistics_organization_id' => $org->id,
                'logistics_hub_id' => $org->hub->id,
                'opened_by_logistics_id' => $logistics->id,
                'reference' => 'SRT-'.now()->format('ymd').'-'.Str::upper(Str::random(8)),
                'status' => SortingSessionStatus::Open,
                'open_key' => $org->id.':'.$org->hub->id,
                'expected_count' => $shipments->count(),
                'revision' => 1,
                'idempotency_key' => $idempotencyKey,
                'request_hash' => $requestHash,
                'opened_at' => now(),
            ]);
            foreach ($shipments as $shipment) {
                $session->items()->create([
                    'shipment_id' => $shipment->id,
                    'status' => SortingItemStatus::Pending,
                    'expected_shipment_revision' => $shipment->revision,
                ]);
            }

            return $this->loadSession($session);
        }, 3);
    }

    public function closeSession(User $logistics, SortingSession $session, int $expectedRevision): SortingSession
    {
        $org = $this->organization($logistics);

        return DB::transaction(function () use ($logistics, $session, $expectedRevision, $org): SortingSession {
            $owned = $this->ownedSession($org, $session->id, true);
            if ($owned->status === SortingSessionStatus::Closed) {
                return $this->loadSession($owned);
            }
            if ($owned->revision !== $expectedRevision) {
                throw FulfillmentException::conflict('SORT_SESSION_REVISION_CONFLICT', 'The sorting session changed. Refresh before closing it.');
            }
            $unresolved = $owned->items()->whereIn('status', [SortingItemStatus::Pending->value, SortingItemStatus::Exception->value])->count();
            if ($unresolved > 0) {
                throw FulfillmentException::conflict('SORT_SESSION_UNRESOLVED', "Resolve {$unresolved} pending or exception parcel(s) before closing this session.");
            }
            $owned->update([
                'status' => SortingSessionStatus::Closed,
                'open_key' => null,
                'closed_by_logistics_id' => $logistics->id,
                'closed_at' => now(),
                'revision' => $owned->revision + 1,
            ]);

            return $this->loadSession($owned);
        }, 3);
    }

    /** @return array<string, mixed> */
    public function processCapture(User $logistics, SortingSession $session, array $capture): array
    {
        $org = $this->organization($logistics);
        $reference = $this->normalizeReference((string) $capture['reference']);
        $autoRoute = (bool) ($capture['auto_route'] ?? (($capture['lane_id'] ?? null) === null));
        $payload = [
            'session_id' => $session->id,
            'lane_id' => $capture['lane_id'] ?? null,
            'auto_route' => $autoRoute,
            'reference' => mb_strtolower($reference),
            'expected_revision' => (int) $capture['expected_revision'],
            'source' => (string) $capture['source'],
            'captured_at' => (string) $capture['captured_at'],
            'exception_code' => $capture['exception_code'] ?? null,
            'reason' => isset($capture['reason']) ? trim((string) $capture['reason']) : null,
        ];
        $requestHash = hash('sha256', json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));

        return DB::transaction(function () use ($logistics, $session, $capture, $org, $reference, $requestHash, $autoRoute): array {
            // Match network configuration lock order before acquiring hub/custody locks.
            DB::table('permissions')->where('slug', 'platform-settings.manage')->lockForUpdate()->first();
            LogisticsHub::query()->whereKey($org->hub->id)->lockForUpdate()->firstOrFail();
            $ownedSession = $this->ownedSession($org, $session->id, true);
            $previous = SortingScan::query()->where('logistics_organization_id', $org->id)->where('client_id', $capture['client_id'])->lockForUpdate()->first();
            if ($previous !== null) {
                if (! hash_equals($previous->request_hash, $requestHash)) {
                    throw FulfillmentException::conflict('IDEMPOTENCY_KEY_REUSED', 'This sorting identifier was already used for another capture.');
                }

                return $this->scanProjection($previous->load(['lane', 'plan', 'planLane']));
            }
            if ($ownedSession->status !== SortingSessionStatus::Open) {
                throw FulfillmentException::conflict('SORT_SESSION_CLOSED', 'This sorting session is already closed.');
            }
            $shipment = $this->fulfillment->recordForLogistics($logistics, $reference);
            $shipment = Shipment::query()->whereKey($shipment->id)->with('parcel.order.address')->lockForUpdate()->firstOrFail();
            $manualException = ! $autoRoute && filled($capture['lane_id'] ?? null)
                && $this->ownedLane($org, (string) $capture['lane_id'], true)->type === SortingLaneType::Exception;
            $autoRoute = $autoRoute || ($shipment->route !== null && $shipment->route->status !== HubRouteStatus::Local && ! $manualException);
            if ($autoRoute) {
                app(ShipmentRouteService::class)->retryHeldAtSorting($shipment);
            }
            $routing = $autoRoute ? $this->sortingPlans->routeForShipment($shipment) : [
                'plan' => null,
                'plan_lane' => null,
                'lane' => null,
                'postal_code' => null,
                'reason' => 'manual_lane',
            ];
            if ($autoRoute) {
                $automaticLaneId = $routing['lane'] instanceof SortingLane
                    ? $routing['lane']->id
                    : $this->sortingPlans->exceptionLaneForContext($org->id, $org->hub->id)?->id;
                if ($automaticLaneId === null) {
                    throw FulfillmentException::invalid('SORT_EXCEPTION_LANE_REQUIRED', 'Create and activate an exception lane before using automatic sorting.');
                }
                $lane = $this->ownedLane($org, $automaticLaneId, true);
            } else {
                if (blank($capture['lane_id'] ?? null)) {
                    throw FulfillmentException::invalid('SORT_LANE_REQUIRED', 'Select a sorting lane or enable automatic sorting.', 'lane_id');
                }
                $lane = $this->ownedLane($org, (string) $capture['lane_id'], true);
            }
            if (! $lane->is_active) {
                throw FulfillmentException::conflict('SORT_LANE_INACTIVE', 'This sorting lane is inactive.');
            }
            $item = SortingSessionItem::query()->where('sorting_session_id', $ownedSession->id)->where('shipment_id', $shipment->id)->lockForUpdate()->first();
            if ($item === null) {
                throw FulfillmentException::conflict('SORT_SESSION_ITEM_NOT_FOUND', 'This parcel is not part of the current sorting session.');
            }
            if ($item->status === SortingItemStatus::Sorted) {
                throw FulfillmentException::conflict('SORT_ITEM_ALREADY_SORTED', 'This parcel was already sorted in the session.');
            }
            if ($shipment->revision !== (int) $capture['expected_revision']) {
                throw FulfillmentException::conflict('SORT_SHIPMENT_REVISION_CONFLICT', 'The parcel changed after this session was loaded. Refresh before sorting it.');
            }
            if ($shipment->status !== ShipmentStatus::ReceivedAtHub) {
                throw FulfillmentException::conflict('SORT_SHIPMENT_STATE_CONFLICT', 'Only a parcel received at this hub can be sorted.');
            }

            $exceptionCode = $capture['exception_code'] ?? null;
            $reason = isset($capture['reason']) ? trim((string) $capture['reason']) : null;
            if ($autoRoute && $routing['lane'] === null) {
                $exceptionCode ??= SortingExceptionCode::DestinationUnclear->value;
                $reason ??= $this->automaticExceptionReason((string) $routing['reason'], $routing['postal_code']);
            }
            if ($lane->type === SortingLaneType::Exception) {
                if ($exceptionCode === null) {
                    throw FulfillmentException::invalid('SORT_EXCEPTION_CODE_REQUIRED', 'Choose an exception reason before scanning into this lane.', 'exception_code');
                }
                if ($exceptionCode === SortingExceptionCode::Other->value && blank($reason)) {
                    throw FulfillmentException::invalid('SORT_EXCEPTION_REASON_REQUIRED', 'Describe the sorting exception.', 'reason');
                }
                $outcome = SortingScanOutcome::Exception;
                $item->update([
                    'sorting_lane_id' => $lane->id,
                    'status' => SortingItemStatus::Exception,
                    'exception_code' => SortingExceptionCode::from((string) $exceptionCode),
                    'exception_reason' => $reason,
                    'exception_recorded_at' => now(),
                    'completed_at' => null,
                ]);
            } else {
                if ($exceptionCode !== null || filled($reason)) {
                    throw FulfillmentException::invalid('SORT_EXCEPTION_NOT_ALLOWED', 'Exception details can only be used with an exception lane.');
                }
                $this->fulfillment->sortAtHub(
                    $logistics,
                    $reference,
                    (int) $capture['expected_revision'],
                    (string) $capture['client_id'],
                    $ownedSession->id,
                    $lane->id,
                    (string) $capture['source'],
                    (string) $capture['captured_at'],
                );
                $outcome = SortingScanOutcome::Sorted;
                $item->update([
                    'sorting_lane_id' => $lane->id,
                    'status' => SortingItemStatus::Sorted,
                    'exception_resolved_at' => $item->status === SortingItemStatus::Exception ? now() : $item->exception_resolved_at,
                    'completed_at' => now(),
                ]);
            }

            $scan = SortingScan::create([
                'logistics_organization_id' => $org->id,
                'logistics_hub_id' => $org->hub->id,
                'sorting_session_id' => $ownedSession->id,
                'sorting_session_item_id' => $item->id,
                'sorting_lane_id' => $lane->id,
                'sorting_plan_id' => $routing['plan']?->id,
                'sorting_plan_lane_id' => $routing['plan_lane']?->id,
                'automatic_routing' => $autoRoute,
                'shipment_id' => $shipment->id,
                'recorded_by_logistics_id' => $logistics->id,
                'client_id' => $capture['client_id'],
                'request_hash' => $requestHash,
                'reference' => $reference,
                'outcome' => $outcome,
                'source' => $capture['source'],
                'exception_code' => $exceptionCode ? SortingExceptionCode::from((string) $exceptionCode) : null,
                'reason' => $reason,
                'captured_at' => $capture['captured_at'],
                'processed_at' => now(),
            ]);

            return $this->scanProjection($scan->load(['lane', 'plan', 'planLane']));
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

    /** @return array<string, mixed> */
    public function laneProjection(SortingLane $lane): array
    {
        return [
            'id' => $lane->id,
            'code' => $lane->code,
            'name' => $lane->name,
            'type' => $lane->type->value,
            'is_active' => $lane->is_active,
            'position' => $lane->position,
            'revision' => $lane->revision,
            'label_payload' => 'AISLEY:SORT-LANE:1:'.$lane->id,
            'label_url' => '/api/v1/logistics/sorting/lanes/'.$lane->id.'/label',
        ];
    }

    /** @return array<string, mixed> */
    public function sessionProjection(SortingSession $session): array
    {
        $session = $session->relationLoaded('items') ? $session : $this->loadSession($session);
        $counts = collect(SortingItemStatus::cases())->mapWithKeys(fn (SortingItemStatus $status): array => [$status->value => $session->items->where('status', $status)->count()])->all();

        return [
            'id' => $session->id,
            'reference' => $session->reference,
            'status' => $session->status->value,
            'expected_count' => $session->expected_count,
            'revision' => $session->revision,
            'opened_at' => $session->opened_at?->toISOString(),
            'closed_at' => $session->closed_at?->toISOString(),
            'counts' => $counts,
            'items' => $session->items->sortBy(fn (SortingSessionItem $item): string => $item->created_at?->format('U.u').'|'.$item->id)->map(fn (SortingSessionItem $item): array => $this->itemProjection($item))->values()->all(),
        ];
    }

    private function itemProjection(SortingSessionItem $item): array
    {
        $shipment = $item->shipment;
        $parcel = $shipment?->parcel;
        $address = $parcel?->order?->address;
        $atThisHub = $shipment?->current_hub_id === $item->session->logistics_hub_id;

        return [
            'id' => $item->id,
            'shipment_id' => $item->shipment_id,
            'reference' => $parcel?->waybill?->reference ?? $parcel?->reference,
            'tracking_id' => $parcel?->waybill?->reference,
            'order_reference' => $parcel?->order?->reference,
            'status' => $item->status->value,
            'expected_revision' => $item->expected_shipment_revision,
            'shipment_revision' => $shipment?->revision,
            'can_move' => $atThisHub && $shipment?->status === ShipmentStatus::SortedAtHub,
            'lane_id' => $item->sorting_lane_id,
            'exception_code' => $item->exception_code?->value,
            'exception_reason' => $item->exception_reason,
            'completed_at' => $item->completed_at?->toISOString(),
            'route' => $shipment ? app(ShipmentRouteService::class)->projection($shipment) : null,
            'automatic_routing' => $this->automaticItemRouting($atThisHub ? $shipment : null),
            'destination' => [
                'barangay' => $address?->barangay,
                'city_municipality' => $address?->city_municipality,
                'province' => $address?->province,
                'region' => $address?->region,
                'postal_code' => $address?->postal_code,
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function automaticItemRouting(?Shipment $shipment): array
    {
        if ($shipment === null) {
            return ['postal_code' => null, 'sort_plan_id' => null, 'sort_plan_name' => null, 'lane' => null, 'reason' => 'shipment_missing'];
        }
        $routing = $this->sortingPlans->routeForShipment($shipment);
        $lane = $routing['lane'] ?? $this->sortingPlans->exceptionLaneForContext(
            (string) $shipment->current_logistics_organization_id,
            (string) $shipment->current_hub_id,
        );

        return [
            'postal_code' => $routing['postal_code'],
            'sort_plan_id' => $routing['plan']?->id,
            'sort_plan_name' => $routing['plan']?->name,
            'lane' => $lane ? $this->laneProjection($lane) : null,
            'reason' => $routing['reason'],
        ];
    }

    /** @return array<string, mixed> */
    private function scanProjection(SortingScan $scan): array
    {
        return [
            'client_id' => $scan->client_id,
            'reference' => $scan->reference,
            'status' => $scan->outcome->value,
            'lane' => $scan->lane ? $this->laneProjection($scan->lane) : null,
            'automatic' => $scan->automatic_routing,
            'sort_plan_id' => $scan->sorting_plan_id,
            'sort_plan_lane_id' => $scan->sorting_plan_lane_id,
            'shipment_id' => $scan->shipment_id,
            'processed_at' => $scan->processed_at?->toISOString(),
            'exception_code' => $scan->exception_code?->value,
            'reason' => $scan->reason,
        ];
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

    private function ownedSession(LogisticsOrganization $org, string $sessionId, bool $lock = false): SortingSession
    {
        $query = SortingSession::query()->whereKey($sessionId)->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id);
        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->first() ?? throw FulfillmentException::notFound('SORT_SESSION_NOT_FOUND', 'This sorting session is unavailable.');
    }

    private function laneCodeExists(LogisticsOrganization $org, string $code, ?string $except = null): bool
    {
        return SortingLane::query()->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id)
            ->where('code', $code)->when($except, fn ($query) => $query->whereKeyNot($except))->exists();
    }

    private function lanes(LogisticsOrganization $org): array
    {
        return SortingLane::query()->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id)
            ->orderBy('position')->orderBy('code')->get()->map(fn (SortingLane $lane): array => $this->laneProjection($lane))->all();
    }

    /** @return array<string, mixed> */
    private function automaticSortingProjection(LogisticsOrganization $org): array
    {
        $plan = SortingPlan::query()
            ->where('logistics_organization_id', $org->id)
            ->where('logistics_hub_id', $org->hub->id)
            ->where('is_active', true)
            ->with('lanes.lane')
            ->first();
        $exceptionLane = $this->sortingPlans->exceptionLaneForContext($org->id, $org->hub->id);

        return [
            'enabled' => $plan !== null,
            'active_plan' => $plan ? $this->sortingPlans->planProjection($plan) : null,
            'exception_lane' => $exceptionLane ? $this->laneProjection($exceptionLane) : null,
        ];
    }

    private function automaticExceptionReason(string $reason, ?string $postalCode): string
    {
        return match ($reason) {
            'no_active_plan' => 'No active sort plan is configured.',
            'postal_code_missing' => 'The recipient postal code is missing or invalid.',
            'postal_code_not_mapped' => $postalCode ? "Postal code {$postalCode} is not mapped in the active sort plan." : 'The recipient postal code is not mapped in the active sort plan.',
            'mapped_lane_unavailable' => 'The mapped standard lane is inactive or unavailable.',
            default => 'Automatic sort-plan routing could not identify a standard lane.',
        };
    }

    private function loadSession(SortingSession $session): SortingSession
    {
        return $session->fresh($this->sessionRelations());
    }

    /** @return array<int, string> */
    private function sessionRelations(): array
    {
        return ['items.lane', 'items.shipment.parcel.waybill', 'items.shipment.parcel.order.address'];
    }

    private function normalizeReference(string $value): string
    {
        $trimmed = trim($value);
        if (preg_match('/^AISLEY:WB:\d+:(.+)$/i', $trimmed, $matches) === 1) {
            $trimmed = $matches[1];
        }

        return mb_strtoupper($trimmed);
    }
}
