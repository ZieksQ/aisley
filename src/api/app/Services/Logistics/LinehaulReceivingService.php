<?php

namespace App\Services\Logistics;

use App\Enums\Logistics\CompanyTruckAvailability;
use App\Enums\Logistics\LinehaulTripDirection;
use App\Enums\Logistics\LinehaulTripStatus;
use App\Enums\Logistics\ReceivingDiscrepancyKind;
use App\Enums\Logistics\UnloadingOutcome;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\LinehaulDiscrepancy;
use App\Models\LinehaulReceipt;
use App\Models\LinehaulReceivingAction;
use App\Models\LinehaulTrip;
use App\Models\LogisticsHub;
use App\Models\Shipment;
use App\Models\User;
use App\Services\Fulfillment\FulfillmentTransitionService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LinehaulReceivingService
{
    public function detail(User $actor, string $id): array
    {
        return DB::transaction(function () use ($actor, $id): array {
            return $this->projection($this->lockedTrip($actor, $id));
        });
    }

    public function start(User $actor, string $id, array $input): array
    {
        return $this->action($actor, $id, 'start', $input, function (LinehaulTrip $trip) use ($actor): array {
            if ($trip->arrived_at !== null) {
                return $this->projection($trip);
            }
            if ($trip->status !== LinehaulTripStatus::InTransfer) {
                throw FulfillmentException::conflict('LINEHAUL_TRIP_CHANGED', 'Only a departed trip can start receiving.');
            }
            $trip->update(['status' => LinehaulTripStatus::Receiving, 'arrived_at' => now(), 'arrived_by' => $actor->id, 'revision' => $trip->revision + 1]);
            $trip->truck()->update(['availability' => CompanyTruckAvailability::Unloading, 'last_confirmed_hub_id' => $trip->to_hub_id, 'revision' => DB::raw('revision + 1')]);
            // Empty returns have no cargo reconciliation step.
            if ($trip->parcel_count === 0) {
                $this->close($trip, $actor, false);
            }

            return $this->projection($trip);
        });
    }

    public function batch(User $actor, string $id, array $captures): array
    {
        $this->detail($actor, $id);
        $results = [];
        foreach ($captures as $capture) {
            try {
                $result = $this->action($actor, $id, 'scan', $capture, fn (LinehaulTrip $trip): array => $this->scan($actor, $trip, $capture));
                $results[] = ['client_id' => $capture['client_id'], ...$result];
            } catch (FulfillmentException $exception) {
                $results[] = ['client_id' => $capture['client_id'], 'status' => 'failed', 'code' => $exception->errorCode, 'message' => $exception->getMessage()];
            }
        }

        return ['results' => $results, 'receiving' => $this->detail($actor, $id)];
    }

    public function finish(User $actor, string $id, array $input): array
    {
        return $this->action($actor, $id, 'finish', $input, function (LinehaulTrip $trip) use ($actor, $input): array {
            if ($trip->unloading_closed_at !== null) {
                return $this->projection($trip);
            }
            if ($trip->status !== LinehaulTripStatus::Receiving) {
                throw FulfillmentException::conflict('LINEHAUL_NOT_RECEIVING', 'Start receiving before closing unloading.');
            }
            $outstanding = collect($this->projection($trip)['items'])->whereNull('receipt');
            if ($outstanding->isNotEmpty() && (! ($input['acknowledge_shortages'] ?? false) || trim($input['reason'] ?? '') === '')) {
                throw FulfillmentException::invalid('SHORTAGE_ACKNOWLEDGEMENT_REQUIRED', 'Acknowledge the outstanding parcels and record a shortage reason.');
            }
            foreach ($outstanding as $item) {
                $this->discrepancy($trip, $actor, 'missing', $item['reference'], $item['shipment_id'], $input['reason']);
            }
            $hasDiscrepancies = LinehaulDiscrepancy::where('linehaul_trip_id', $trip->id)->exists();
            $this->close($trip, $actor, $hasDiscrepancies);
            if ($hasDiscrepancies) {
                app(LogisticsNotificationService::class)->queueLinehaulDiscrepancies($trip);
            }

            return $this->projection($trip);
        });
    }

    public function resolve(User $actor, string $id, string $discrepancyId, array $input): array
    {
        return $this->action($actor, $id, 'resolve', ['discrepancy_id' => $discrepancyId, ...$input], function (LinehaulTrip $trip) use ($actor, $input, $discrepancyId): array {
            $record = LinehaulDiscrepancy::where('linehaul_trip_id', $trip->id)->whereKey($discrepancyId)->lockForUpdate()->first();
            if ($record === null) {
                throw FulfillmentException::notFound();
            }
            if ($record->kind === ReceivingDiscrepancyKind::Missing) {
                throw FulfillmentException::conflict('RECEIPT_REQUIRED', 'A missing parcel is resolved only by a verified receipt.');
            }
            if ($record->resolved_at === null) {
                if ($record->kind === ReceivingDiscrepancyKind::Damaged) {
                    $shipment = Shipment::whereKey($record->shipment_id)->where('current_hub_id', $trip->to_hub_id)->lockForUpdate()->first();
                    if ($shipment === null) {
                        throw FulfillmentException::notFound();
                    }
                    $shipment->update(['condition_hold' => false, 'revision' => $shipment->revision + 1]);
                }
                $record->update(['resolved_at' => now(), 'resolved_by' => $actor->id, 'resolution_reason' => $input['reason']]);
            }

            return $this->projection($trip);
        });
    }

    private function scan(User $actor, LinehaulTrip $trip, array $capture): array
    {
        if ($trip->arrived_at === null || ! in_array($trip->status, [LinehaulTripStatus::Receiving, LinehaulTripStatus::Received], true)) {
            throw FulfillmentException::conflict('LINEHAUL_NOT_RECEIVING', 'Start receiving online before synchronizing scans.');
        }
        $reference = mb_strtoupper(trim(preg_replace('/^AISLEY:WB:\d+:/i', '', trim($capture['reference']))));
        $member = $trip->shipments()->whereHas('shipment.parcel.waybill', fn ($query) => $query->whereRaw('UPPER(reference) = ?', [$reference]))->with(['shipment', 'hop'])->first();
        if ($member === null) {
            $record = $this->discrepancy($trip, $actor, 'unexpected', $reference, null, $capture['reason'] ?? null);

            return ['status' => 'unexpected', 'reference' => $reference, 'discrepancy_id' => $record->id];
        }
        $prior = LinehaulReceipt::where('linehaul_trip_id', $trip->id)->where('shipment_id', $member->shipment_id)->first();
        if ($prior !== null) {
            return $prior->result;
        }
        $result = app(FulfillmentTransitionService::class)->transferAtHub($actor, [
            'reference' => $reference, 'hop_id' => $member->shipment_route_hop_id,
            'expected_revision' => $member->shipment->revision, 'expected_hop_revision' => $member->hop->revision,
        ], (string) Str::uuid(), true, $trip->linehaul_manifest_id);
        $receiptId = (string) Str::uuid();
        $result = ['status' => 'received', 'receipt_id' => $receiptId, 'reference' => $reference,
            'condition' => $capture['condition'], 'committed_at' => now()->toISOString(), 'transfer' => $result];
        LinehaulReceipt::create([
            'id' => $receiptId, 'linehaul_trip_id' => $trip->id, 'shipment_id' => $member->shipment_id,
            'recorded_by' => $actor->id, 'reference' => $reference, 'condition' => $capture['condition'],
            'source' => $capture['source'], 'captured_at' => $capture['captured_at'], 'committed_at' => now(), 'result' => $result,
        ]);
        $member->update(['released_at' => now()]);
        if ($capture['condition'] === 'damaged') {
            Shipment::whereKey($member->shipment_id)->update(['condition_hold' => true]);
            $this->discrepancy($trip, $actor, 'damaged', $reference, $member->shipment_id, $capture['reason']);
        }
        LinehaulDiscrepancy::where('linehaul_trip_id', $trip->id)->where('shipment_id', $member->shipment_id)->where('kind', 'missing')->whereNull('resolved_at')
            ->update(['resolved_at' => now(), 'resolved_by' => $actor->id, 'resolution_reason' => 'Verified late receipt '.$receiptId]);
        if (LinehaulReceipt::where('linehaul_trip_id', $trip->id)->count() === $trip->parcel_count) {
            DB::table('linehaul_manifests')->where('id', $trip->linehaul_manifest_id)->update(['status' => 'received', 'received_at' => now(), 'updated_at' => now()]);
        }

        return $result;
    }

    private function close(LinehaulTrip $trip, User $actor, bool $discrepancies): void
    {
        $trip->update(['status' => LinehaulTripStatus::Received, 'received_at' => now(), 'unloading_closed_at' => now(),
            'unloading_closed_by' => $actor->id, 'unloading_outcome' => $discrepancies ? UnloadingOutcome::Discrepancies : UnloadingOutcome::Clean, 'revision' => $trip->revision + 1]);
        $trip->truck()->update(['availability' => $trip->direction === LinehaulTripDirection::Return ? CompanyTruckAvailability::Available : CompanyTruckAvailability::Visiting,
            'last_confirmed_hub_id' => $trip->to_hub_id, 'revision' => DB::raw('revision + 1')]);
    }

    private function discrepancy(LinehaulTrip $trip, User $actor, string $kind, string $reference, ?string $shipmentId, ?string $reason): LinehaulDiscrepancy
    {
        return LinehaulDiscrepancy::firstOrCreate(['linehaul_trip_id' => $trip->id, 'kind' => $kind, 'reference' => $reference],
            ['shipment_id' => $shipmentId, 'recorded_by' => $actor->id, 'reason' => $reason, 'created_at' => now()]);
    }

    private function action(User $actor, string $id, string $operation, array $input, callable $perform): array
    {
        return DB::transaction(function () use ($actor, $id, $operation, $input, $perform): array {
            $trip = $this->lockedTrip($actor, $id);
            ksort($input);
            $hash = hash('sha256', json_encode([$id, $operation, $input], JSON_THROW_ON_ERROR));
            $prior = LinehaulReceivingAction::where('actor_id', $actor->id)->where('client_id', $input['client_id'])->first();
            if ($prior !== null) {
                if (! hash_equals($prior->request_hash, $hash)) {
                    throw FulfillmentException::conflict('IDEMPOTENCY_KEY_REUSED', 'This request identity has a different payload.');
                }

                return $prior->result;
            }
            $result = $perform($trip);
            LinehaulReceivingAction::create(['linehaul_trip_id' => $id, 'actor_id' => $actor->id, 'client_id' => $input['client_id'],
                'operation' => $operation, 'request_hash' => $hash, 'payload' => $input, 'result' => $result, 'committed_at' => now()]);

            return $result;
        }, 3);
    }

    private function lockedTrip(User $actor, string $id): LinehaulTrip
    {
        $org = $actor->logisticsOrganization()->with('hub')->first();
        if ($org?->hub === null) {
            throw FulfillmentException::notFound();
        }
        // All receipt, sorting and closure operations use the same lock order.
        LogisticsHub::whereKey($org->hub->id)->lockForUpdate()->firstOrFail();
        $trip = LinehaulTrip::whereKey($id)->where('to_hub_id', $org->hub->id)->lockForUpdate()->first();
        if ($trip === null) {
            throw FulfillmentException::notFound();
        }

        return $trip;
    }

    private function projection(LinehaulTrip $trip): array
    {
        return app(LinehaulReceivingProjection::class)->make($trip);
    }
}
