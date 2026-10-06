<?php

namespace App\Services\Logistics;

use App\Enums\Logistics\HubRouteStatus;
use App\Enums\Logistics\SortingExceptionCode;
use App\Enums\Logistics\SortingItemStatus;
use App\Enums\Logistics\SortingLaneState;
use App\Enums\Logistics\SortingLaneType;
use App\Enums\Logistics\SortingScanOutcome;
use App\Enums\Logistics\SortingSessionStatus;
use App\Enums\ShipmentStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\LogisticsHub;
use App\Models\LogisticsOrganization;
use App\Models\Shipment;
use App\Models\SortingLane;
use App\Models\SortingPlanLane;
use App\Models\SortingScan;
use App\Models\SortingSession;
use App\Models\SortingSessionItem;
use App\Models\User;
use App\Services\Fulfillment\FulfillmentTransitionService;
use App\Services\Logistics\Routing\ShipmentRouteService;
use App\Services\Logistics\Sorting\SortingAssignmentService;
use App\Services\Logistics\Sorting\SortingExceptionService;
use App\Services\Logistics\Sorting\SortingLaneService;
use App\Services\Logistics\Sorting\SortingSessionService;
use App\Services\Logistics\Sorting\SortingVersionService;
use Illuminate\Support\Facades\DB;
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
        app(SortingVersionService::class)->recoverHub($org->hub->id);
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
            ->where('condition_hold', false)
            ->whereDoesntHave('sortingExceptions', fn ($q) => $q->whereNull('resolved_at')->where('logistics_hub_id', $org->hub->id))
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
        return app(SortingLaneService::class)->createLane($logistics, $input);
    }

    public function updateLane(User $logistics, SortingLane $lane, array $input): SortingLane
    {
        return app(SortingLaneService::class)->updateLane($logistics, $lane, $input);
    }

    public function openSession(User $logistics, string $idempotencyKey, array $recoveryIds = []): SortingSession
    {
        return app(SortingSessionService::class)->openSession($logistics, $idempotencyKey, $recoveryIds);
    }

    public function closeSession(User $logistics, SortingSession $session, int $expectedRevision, bool $carryOver = false): SortingSession
    {
        return app(SortingSessionService::class)->closeSession($logistics, $session, $expectedRevision, $carryOver);
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
            app(SortingVersionService::class)->recoverHubLocked($org->hub->id);
            $ownedSession = $this->ownedSession($org, $session->id, true);
            $previous = SortingScan::query()->where('logistics_organization_id', $org->id)->where('client_id', $capture['client_id'])->lockForUpdate()->first();
            if ($previous !== null) {
                if (! hash_equals($previous->request_hash, $requestHash)) {
                    throw FulfillmentException::conflict('IDEMPOTENCY_KEY_REUSED', 'This sorting identifier was already used for another capture.');
                }

                return $previous->result_snapshot ?? $this->scanProjection($previous->load(['lane', 'plan', 'planLane']));
            }
            if ($ownedSession->status !== SortingSessionStatus::Open) {
                throw FulfillmentException::conflict('SORT_SESSION_CLOSED', 'This sorting session is already closed.');
            }
            $shipment = $this->fulfillment->recordForLogistics($logistics, $reference);
            $shipment = Shipment::query()->whereKey($shipment->id)->with('parcel.order.address')->lockForUpdate()->firstOrFail();
            $outstanding = app(SortingExceptionService::class)->outstanding($shipment);
            if ($outstanding && ! $autoRoute && $this->ownedLane($org, (string) ($capture['lane_id'] ?? ''), true)->type === SortingLaneType::Standard) {
                throw FulfillmentException::conflict('SORT_EXCEPTION_RESCAN_REQUIRED', 'Recover outstanding exceptions with a new automatic scan after correction.');
            }
            $manualException = ! $autoRoute && filled($capture['lane_id'] ?? null)
                && $this->ownedLane($org, (string) $capture['lane_id'], true)->type === SortingLaneType::Exception;
            $autoRoute = $autoRoute || ($shipment->route !== null && $shipment->route->status !== HubRouteStatus::Local && ! $manualException);
            if ($autoRoute) {
                app(ShipmentRouteService::class)->retryHeldAtSorting($shipment);
            }
            $routing = $this->sortingPlans->routeForShipment($shipment);
            if (! $autoRoute) {
                $routing['reason'] = 'manual_lane';
            }
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
            if ($lane->operational_state !== SortingLaneState::Open) {
                $routing['reason'] = 'lane_blocked';
                $routing['lane'] = null;
                $lane = $this->sortingPlans->exceptionLaneForContext($org->id, $org->hub->id)
                    ?? throw FulfillmentException::invalid('SORT_EXCEPTION_LANE_REQUIRED', 'Configure an open exception lane.');
                $autoRoute = true;
            }
            if ($outstanding?->exception_code === SortingExceptionCode::Damaged && $outstanding->released_at === null) {
                $routing['reason'] = 'damage_inspection_required';
                $routing['lane'] = null;
                $lane = $this->sortingPlans->exceptionLaneForContext($org->id, $org->hub->id)
                    ?? throw FulfillmentException::invalid('SORT_EXCEPTION_LANE_REQUIRED', 'Configure an open exception lane.');
                $autoRoute = true;
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
            if ($shipment->condition_hold || $shipment->status !== ShipmentStatus::ReceivedAtHub) {
                throw FulfillmentException::conflict('SORT_SHIPMENT_STATE_CONFLICT', 'Only a parcel received at this hub can be sorted.');
            }

            $exceptionCode = $routing['reason'] === 'damage_inspection_required' ? SortingExceptionCode::Damaged->value : ($capture['exception_code'] ?? null);
            $reason = isset($capture['reason']) ? trim((string) $capture['reason']) : null;
            if ($autoRoute && $routing['lane'] === null) {
                $exceptionCode ??= SortingExceptionCode::DestinationUnclear->value;
                $reason ??= $this->automaticExceptionReason((string) $routing['reason'], $routing['postal_code']);
            }
            if (! $autoRoute && $routing['lane']?->id !== $lane->id) {
                $routing['plan_lane'] = null;
            }
            $assignment = app(SortingAssignmentService::class)->snapshot($shipment, $lane, $routing, $logistics->id);
            if ($lane->type === SortingLaneType::Exception) {
                if ($exceptionCode === null) {
                    throw FulfillmentException::invalid('SORT_EXCEPTION_CODE_REQUIRED', 'Choose an exception reason before scanning into this lane.', 'exception_code');
                }
                if ($exceptionCode === SortingExceptionCode::Other->value && blank($reason)) {
                    throw FulfillmentException::invalid('SORT_EXCEPTION_REASON_REQUIRED', 'Describe the sorting exception.', 'reason');
                }
                $outcome = SortingScanOutcome::Exception;
                $item->update([
                    'assignment_snapshot' => $assignment,
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
                    $assignment,
                );
                $outcome = SortingScanOutcome::Sorted;
                $item->update([
                    'assignment_snapshot' => $assignment,
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
                'sorting_plan_version_id' => $routing['plan']?->active_version_id,
                'assignment_snapshot' => $assignment,
                'sorting_plan_id' => $routing['plan']?->id,
                'sorting_plan_lane_id' => $routing['plan_lane'] && SortingPlanLane::whereKey($routing['plan_lane']->id)->exists() ? $routing['plan_lane']->id : null,
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

            $exceptions = app(SortingExceptionService::class);
            if ($outcome === SortingScanOutcome::Exception) {
                $exceptions->record($shipment, $scan, $routing['reason']);
            } else {
                $exceptions->resolve($shipment, $scan);
            }
            $result = $this->scanProjection($scan->load(['lane', 'plan', 'planLane']));
            $scan->update(['result_snapshot' => $result]);

            return $result;
        }, 3);
    }

    public function labelResponse(User $logistics, SortingLane $lane): Response
    {
        return app(SortingLaneService::class)->labelResponse($logistics, $lane);
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
            'operational_state' => $lane->operational_state->value,
            'blocking_reason' => $lane->blocking_reason,
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
            'sorting_assignment' => $item->assignment_snapshot,
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
            'lane' => $scan->assignment_snapshot['lane'] ?? null,
            'sorting_assignment' => $scan->assignment_snapshot,
            'version_id' => $scan->sorting_plan_version_id,
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

    private function lanes(LogisticsOrganization $org): array
    {
        return SortingLane::query()->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id)
            ->orderBy('position')->orderBy('code')->get()->map(fn (SortingLane $lane): array => $this->laneProjection($lane))->all();
    }

    /** @return array<string, mixed> */
    private function automaticSortingProjection(LogisticsOrganization $org): array
    {
        $plan = $this->sortingPlans->plansForHub($org->id, $org->hub->id);
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
            'hub_lane_unavailable' => 'The committed next hub has no available standard lane in the active version.',
            'lane_blocked' => 'The selected lane is paused or held. Resume the lane before rescanning.',
            'connection_unavailable' => 'The committed hub connection is unavailable. Restore it before rescanning.',
            'damage_inspection_required' => 'Document inspection and release before rescanning this damaged parcel.',
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
