<?php

namespace App\Services\Logistics;

use App\Enums\CourierAffiliationStatus;
use App\Enums\DispatchScheduleStatus;
use App\Enums\ShipmentStatus;
use App\Enums\UserStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\CourierLogisticsAffiliation;
use App\Models\DispatchSchedule;
use App\Models\Shipment;
use App\Models\User;
use App\Services\Fulfillment\FulfillmentTransitionService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DispatchScheduleService
{
    public function __construct(private readonly FulfillmentTransitionService $fulfillment) {}

    public function create(User $logistics, array $input, string $idempotencyKey): DispatchSchedule
    {
        $requestHash = hash('sha256', json_encode($input, JSON_THROW_ON_ERROR));

        return DB::transaction(function () use ($logistics, $input, $idempotencyKey, $requestHash): DispatchSchedule {
            $previous = DispatchSchedule::query()->where('created_by_logistics_id', $logistics->id)->where('idempotency_key', $idempotencyKey)->lockForUpdate()->first();
            if ($previous !== null) {
                if (! hash_equals($previous->request_hash, $requestHash)) {
                    throw FulfillmentException::conflict('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for another dispatch schedule.');
                }

                return $this->load($previous);
            }

            $org = $this->organization($logistics);
            $this->assertCourier((string) $input['courier_id'], $org->id, $org->hub->id);
            $shipmentIds = array_values($input['shipment_ids']);
            $shipments = Shipment::query()->whereIn('id', $shipmentIds)
                ->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id)
                ->with('parcel.waybill')->lockForUpdate()->get()->keyBy('id');
            if ($shipments->count() !== count($shipmentIds)) {
                throw FulfillmentException::notFound('SHIPMENT_NOT_FOUND', 'One or more selected parcels are not available to this hub.');
            }
            if ($shipments->contains(fn (Shipment $shipment): bool => $shipment->status !== ShipmentStatus::SortedAtHub)) {
                throw FulfillmentException::conflict('DISPATCH_STATE_CONFLICT', 'Only parcels sorted at this hub are ready to dispatch.');
            }

            $schedule = DispatchSchedule::create([
                'logistics_organization_id' => $org->id,
                'logistics_hub_id' => $org->hub->id,
                'courier_id' => $input['courier_id'],
                'created_by_logistics_id' => $logistics->id,
                'reference' => 'DSP-'.now()->format('ymd').'-'.Str::upper(Str::random(8)),
                'scheduled_for' => $input['scheduled_for'],
                'status' => DispatchScheduleStatus::Scheduled,
                'parcel_count' => count($shipmentIds),
                'revision' => 1,
                'idempotency_key' => $idempotencyKey,
                'request_hash' => $requestHash,
            ]);

            foreach ($shipmentIds as $index => $shipmentId) {
                $shipment = $shipments->get($shipmentId);
                $transition = $this->fulfillment->transitionLogistics($logistics, [
                    'reference' => $shipment->parcel->waybill->reference,
                    'target_state' => ShipmentStatus::DispatchedFromHub->value,
                    'expected_revision' => $shipment->revision,
                    'reason' => 'Dispatch schedule '.$schedule->reference,
                ], (string) Str::uuid());
                $task = $transition['task'];
                $offer = $this->fulfillment->offerFinal($logistics, $task->id, (string) $input['courier_id'], $task->revision, (string) Str::uuid());
                $schedule->shipments()->create([
                    'shipment_id' => $shipmentId,
                    'delivery_task_id' => $offer['task']->id,
                    'sequence' => $index + 1,
                ]);
            }

            return $this->load($schedule);
        }, 3);
    }

    public function couriers(User $logistics): Collection
    {
        $org = $this->organization($logistics);

        return CourierLogisticsAffiliation::query()->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id)
            ->where('status', CourierAffiliationStatus::Approved)->whereHas('courier', fn ($query) => $query->where('status', UserStatus::Active))
            ->with('courier.courierProfile')->orderBy('created_at')->get()->map(fn (CourierLogisticsAffiliation $affiliation): array => [
                'courier_id' => $affiliation->courier_id,
                'name' => trim(($affiliation->courier->courierProfile?->first_name ?? '').' '.($affiliation->courier->courierProfile?->last_name ?? '')) ?: $affiliation->courier->email,
                'email' => $affiliation->courier->email,
                'contact_number' => $affiliation->courier->courierProfile?->contact_number,
            ])->values();
    }

    public function schedules(User $logistics): Collection
    {
        $org = $this->organization($logistics);

        return DispatchSchedule::query()->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id)
            ->with(['courier.courierProfile', 'shipments.shipment.parcel.waybill', 'shipments.shipment.parcel.order'])
            ->orderByDesc('scheduled_for')->orderByDesc('id')->limit(50)->get()->map(fn (DispatchSchedule $schedule): array => $this->projection($schedule))->values();
    }

    public function projection(DispatchSchedule $schedule): array
    {
        $schedule = $this->load($schedule);
        $profile = $schedule->courier?->courierProfile;

        return [
            'id' => $schedule->id,
            'reference' => $schedule->reference,
            'status' => $schedule->status->value,
            'scheduled_for' => $schedule->scheduled_for->toISOString(),
            'parcel_count' => $schedule->parcel_count,
            'revision' => $schedule->revision,
            'courier' => ['id' => $schedule->courier_id, 'name' => trim(($profile?->first_name ?? '').' '.($profile?->last_name ?? '')) ?: $schedule->courier?->email, 'email' => $schedule->courier?->email, 'contact_number' => $profile?->contact_number],
            'parcels' => $schedule->shipments->sortBy('sequence')->map(fn ($item): array => [
                'shipment_id' => $item->shipment_id,
                'order_reference' => $item->shipment?->parcel?->order?->reference,
                'waybill_reference' => $item->shipment?->parcel?->waybill?->reference,
                'sequence' => $item->sequence,
            ])->values()->all(),
        ];
    }

    private function load(DispatchSchedule $schedule): DispatchSchedule
    {
        return $schedule->fresh(['courier.courierProfile', 'shipments.shipment.parcel.waybill', 'shipments.shipment.parcel.order']);
    }

    private function organization(User $logistics)
    {
        $org = $logistics->logisticsOrganization()->with('hub')->first();
        if ($org === null || $org->hub === null) {
            throw FulfillmentException::notFound('LOGISTICS_CONTEXT_NOT_FOUND', 'The Logistics organization or operational hub is unavailable.');
        }

        return $org;
    }

    private function assertCourier(string $courierId, string $orgId, string $hubId): void
    {
        $eligible = CourierLogisticsAffiliation::query()->where('courier_id', $courierId)->where('logistics_organization_id', $orgId)->where('logistics_hub_id', $hubId)
            ->where('status', CourierAffiliationStatus::Approved)->whereHas('courier', fn ($query) => $query->where('status', UserStatus::Active))->exists();
        if (! $eligible) {
            throw FulfillmentException::invalid('COURIER_NOT_ELIGIBLE', 'Select an active Courier approved for this Logistics organization.', 'courier_id');
        }
    }
}
