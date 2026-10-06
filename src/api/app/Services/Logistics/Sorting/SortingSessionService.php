<?php

namespace App\Services\Logistics\Sorting;

use App\Enums\Logistics\SortingItemStatus;
use App\Enums\Logistics\SortingLaneType;
use App\Enums\Logistics\SortingSessionStatus;
use App\Enums\ShipmentStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\LogisticsOrganization;
use App\Models\Shipment;
use App\Models\SortingLane;
use App\Models\SortingSession;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SortingSessionService
{
    private const SESSION_LIMIT = 100;

    public function openSession(User $logistics, string $idempotencyKey, array $recoveryIds = []): SortingSession
    {
        $org = $this->organization($logistics);
        sort($recoveryIds);
        $requestHash = hash('sha256', json_encode($recoveryIds).'|sorting-session-v1|'.$org->id.'|'.$org->hub->id);

        return DB::transaction(function () use ($logistics, $org, $idempotencyKey, $requestHash, $recoveryIds): SortingSession {
            SortingLocks::hub($org->hub->id);
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
                ->where('condition_hold', false)
                ->when($recoveryIds !== [], fn ($q) => $q->whereKey($recoveryIds)->whereHas('sortingExceptions', fn ($e) => $e->whereNull('resolved_at')->where('logistics_hub_id', $org->hub->id)), fn ($q) => $q->whereDoesntHave('sortingExceptions', fn ($e) => $e->whereNull('resolved_at')->where('logistics_hub_id', $org->hub->id)))
                ->whereDoesntHave('sortingItems', fn ($query) => $query->whereHas('session', fn ($session) => $session->where('status', SortingSessionStatus::Open->value)->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id)))
                ->orderByRaw('COALESCE(received_at_hub_at, created_at)')->orderBy('id')->limit(self::SESSION_LIMIT)->lockForUpdate()->get();
            if ($recoveryIds !== [] && $shipments->count() !== count($recoveryIds)) {
                throw FulfillmentException::conflict('SORT_RECOVERY_SELECTION_CHANGED', 'Select outstanding received exceptions without a condition hold.');
            }
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

    public function closeSession(User $logistics, SortingSession $session, int $expectedRevision, bool $carryOver = false): SortingSession
    {
        $org = $this->organization($logistics);

        return DB::transaction(function () use ($logistics, $session, $expectedRevision, $org, $carryOver): SortingSession {
            SortingLocks::hub($org->hub->id);
            $owned = $this->ownedSession($org, $session->id, true);
            if ($owned->status === SortingSessionStatus::Closed) {
                return $this->loadSession($owned);
            }
            if ($owned->revision !== $expectedRevision) {
                throw FulfillmentException::conflict('SORT_SESSION_REVISION_CONFLICT', 'The sorting session changed. Refresh before closing it.');
            }
            $unresolved = $owned->items()->where('status', SortingItemStatus::Pending->value)->count();
            if ($unresolved > 0) {
                throw FulfillmentException::conflict('SORT_SESSION_UNRESOLVED', "Resolve {$unresolved} pending or exception parcel(s) before closing this session.");
            }
            if (! $carryOver && $owned->items()->where('status', 'exception')->exists()) {
                throw FulfillmentException::conflict('SORT_CARRY_OVER_REQUIRED', 'Acknowledge that unresolved exceptions remain in the durable queue before closing.');
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

    private function organization(User $logistics): LogisticsOrganization
    {
        $org = $logistics->logisticsOrganization()->with('hub')->first();
        if ($org === null || $org->hub === null) {
            throw FulfillmentException::notFound('LOGISTICS_CONTEXT_NOT_FOUND', 'The Logistics organization or operational hub is unavailable.');
        }

        return $org;
    }

    private function ownedSession(LogisticsOrganization $org, string $sessionId, bool $lock = false): SortingSession
    {
        $query = SortingSession::query()->whereKey($sessionId)->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id);
        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->first() ?? throw FulfillmentException::notFound('SORT_SESSION_NOT_FOUND', 'This sorting session is unavailable.');
    }

    private function loadSession(SortingSession $session): SortingSession
    {
        return $session->fresh(['items.lane', 'items.shipment.parcel.waybill', 'items.shipment.parcel.order.address']);
    }
}
