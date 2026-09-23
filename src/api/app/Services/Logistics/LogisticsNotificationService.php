<?php

namespace App\Services\Logistics;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Jobs\Logistics\DeliverLogisticsNotification;
use App\Models\CompletionIntent;
use App\Models\CourierLogisticsAffiliation;
use App\Models\DeliveryTask;
use App\Models\DeliveryTaskOffer;
use App\Models\LinehaulTrip;
use App\Models\SellerPickupRequest;
use App\Models\ShipmentEvidence;
use App\Models\User;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

class LogisticsNotificationService
{
    /** @var list<string> */
    public const TYPES = [
        'logistics-pickup.requested',
        'logistics-courier.application-pending',
        'logistics-task.offer-rejected',
        'logistics-evidence.submitted',
        'logistics-completion.requested',
        'logistics-courier.vehicle-updated',
        'logistics-linehaul.return-scheduled',
        'logistics-linehaul.receiving-discrepancies',
    ];

    /** @return MorphMany<DatabaseNotification> */
    public function query(User $logistics)
    {
        return $logistics->notifications()->whereIn('type', self::TYPES);
    }

    /** @return array<string, mixed> */
    public function project(DatabaseNotification $notification, User $logistics): array
    {
        $data = $this->data($notification->data);
        $type = (string) $notification->type;
        $context = $this->context($type, $data, $logistics);
        [$title, $summary] = $this->copy($type, $data);

        return [
            'id' => (string) $notification->id,
            'type' => $type,
            'title' => $title,
            'summary' => $summary,
            'read_at' => $this->utc($notification->read_at),
            'created_at' => $this->utc($notification->created_at),
            'resource_type' => $context['resource_type'],
            'resource_id' => $context['resource_id'],
            'destination' => $context['destination'],
        ];
    }

    public function queuePickupRequested(SellerPickupRequest|string $pickup): void
    {
        $id = $pickup instanceof SellerPickupRequest ? (string) $pickup->id : $pickup;
        $this->afterCommit(fn () => $this->deliverPickup($id));
    }

    public function queueCourierApplicationPending(CourierLogisticsAffiliation|string $affiliation): void
    {
        $id = $affiliation instanceof CourierLogisticsAffiliation ? (string) $affiliation->id : $affiliation;
        $this->afterCommit(fn () => $this->deliverAffiliation($id));
    }

    public function queueOfferRejected(DeliveryTaskOffer|string $offer): void
    {
        $id = $offer instanceof DeliveryTaskOffer ? (string) $offer->id : $offer;
        $this->afterCommit(fn () => $this->deliverOffer($id));
    }

    public function queueEvidenceSubmitted(ShipmentEvidence|string $evidence): void
    {
        $id = $evidence instanceof ShipmentEvidence ? (string) $evidence->id : $evidence;
        $this->afterCommit(fn () => $this->deliverEvidence($id));
    }

    public function queueCompletionRequested(CompletionIntent|string $intent): void
    {
        $id = $intent instanceof CompletionIntent ? (string) $intent->id : $intent;
        $this->afterCommit(fn () => $this->deliverCompletion($id));
    }

    /** @param list<string> $changedFields */
    public function queueVehicleUpdated(string $vehicleId, string $courierId, int $revision, array $changedFields): void
    {
        $this->afterCommit(fn () => $this->deliverVehicleUpdated($vehicleId, $courierId, $revision, $changedFields));
    }

    public function queueLinehaulReturn(LinehaulTrip|string $trip): void
    {
        $tripId = $trip instanceof LinehaulTrip ? (string) $trip->id : $trip;
        $this->afterCommit(function () use ($tripId): void {
            $record = LinehaulTrip::query()->whereKey($tripId)->first();
            if ($record === null) {
                return;
            }
            $recipient = $this->recipient($record->owner_logistics_organization_id, $record->home_hub_id);
            if ($recipient !== null) {
                $this->dispatch($recipient, 'logistics-linehaul.return-scheduled', "linehaul-return:{$record->id}:revision:{$record->revision}", $record->updated_at, [
                    'trip_id' => $record->id,
                    'title' => 'Return linehaul scheduled',
                    'summary' => 'The receiving Logistics partner scheduled your driver and truck to return home.',
                ]);
            }
        });
    }

    public function queueLinehaulDiscrepancies(LinehaulTrip $trip): void
    {
        $id = $trip->id;
        $this->afterCommit(function () use ($id): void {
            $trip = LinehaulTrip::with('fromHub')->find($id);
            if ($trip === null) {
                return;
            }
            $recipient = $this->recipient($trip->fromHub->logistics_organization_id, $trip->from_hub_id);
            if ($recipient !== null) {
                $this->dispatch($recipient, 'logistics-linehaul.receiving-discrepancies', "linehaul-discrepancies:{$id}", Carbon::parse($trip->unloading_closed_at), [
                    'trip_id' => $id, 'title' => 'Linehaul receiving discrepancies',
                    'summary' => 'The receiving hub closed unloading with recorded parcel discrepancies.',
                ]);
            }
        });
    }

    private function deliverPickup(string $id): void
    {
        $pickup = SellerPickupRequest::query()->whereKey($id)->with('orders')->first();
        if ($pickup === null) {
            return;
        }

        $recipient = $this->recipient($pickup->logistics_organization_id, $pickup->logistics_hub_id);
        if ($recipient === null) {
            return;
        }

        $count = min(10000, max(0, $pickup->orders()->count()));
        $this->dispatch($recipient, 'logistics-pickup.requested', "pickup:{$pickup->id}", $pickup->created_at, [
            'pickup_request_id' => $pickup->id,
            'shop_id' => $pickup->shop_id,
            'order_count' => $count,
            'status' => is_string($pickup->status) ? $pickup->status : $pickup->status?->value,
            'title' => 'New pickup request',
            'summary' => "A Seller requested pickup for {$count} ".($count === 1 ? 'Order.' : 'Orders.'),
            'resource_type' => 'pickup_request',
            'resource_id' => $pickup->id,
        ]);
    }

    private function deliverAffiliation(string $id): void
    {
        $affiliation = CourierLogisticsAffiliation::query()->whereKey($id)->first();
        if ($affiliation === null) {
            return;
        }
        $recipient = $this->recipient($affiliation->logistics_organization_id, $affiliation->logistics_hub_id);
        if ($recipient === null) {
            return;
        }

        $this->dispatch($recipient, 'logistics-courier.application-pending', "affiliation:{$affiliation->id}", $affiliation->created_at, [
            'affiliation_id' => $affiliation->id,
            'title' => 'Courier application pending',
            'summary' => 'A Courier application is waiting for your review.',
            'resource_type' => 'courier_affiliation',
            'resource_id' => $affiliation->id,
        ]);
    }

    private function deliverOffer(string $id): void
    {
        $offer = DeliveryTaskOffer::query()->whereKey($id)->with('task.shipment.parcel.waybill')->first();
        $task = $offer?->task;
        $shipment = $task?->shipment;
        if ($offer === null || $task === null || $shipment === null) {
            return;
        }
        $recipient = $this->recipient($offer->logistics_organization_id, $shipment->current_hub_id);
        if ($recipient === null) {
            return;
        }

        $this->dispatch($recipient, 'logistics-task.offer-rejected', "offer:{$offer->id}", $offer->responded_at ?? $offer->updated_at, [
            'offer_id' => $offer->id,
            'task_id' => $task->id,
            'title' => 'Final-mile offer rejected',
            'summary' => 'A Courier rejected a final-mile offer and the task can be re-offered.',
            'resource_type' => 'delivery_task',
            'resource_id' => $task->id,
        ]);
    }

    private function deliverEvidence(string $id): void
    {
        $evidence = ShipmentEvidence::query()->whereKey($id)->with('task.shipment')->first();
        $task = $evidence?->task;
        $shipment = $task?->shipment;
        if ($evidence === null || $task === null || $shipment === null) {
            return;
        }
        $recipient = $this->recipient($shipment->current_logistics_organization_id, $shipment->current_hub_id);
        if ($recipient === null) {
            return;
        }
        $purpose = $evidence->purpose instanceof \BackedEnum
            ? (string) $evidence->purpose->value
            : ($this->value($evidence->purpose, 50) ?? 'evidence');
        $label = $purpose === 'hub_pickup' ? 'hub-pickup evidence' : 'delivery proof';

        $this->dispatch($recipient, 'logistics-evidence.submitted', "evidence:{$evidence->id}:{$purpose}", $evidence->submitted_at ?? $evidence->created_at, [
            'evidence_id' => $evidence->id,
            'task_id' => $task->id,
            'purpose' => $purpose,
            'title' => 'Evidence submitted',
            'summary' => "New {$label} is waiting for Logistics validation.",
            'resource_type' => 'shipment_evidence',
            'resource_id' => $evidence->id,
        ]);
    }

    private function deliverCompletion(string $id): void
    {
        $intent = CompletionIntent::query()->whereKey($id)->with('task.shipment')->first();
        $task = $intent?->task;
        $shipment = $task?->shipment;
        if ($intent === null || $task === null || $shipment === null) {
            return;
        }
        $recipient = $this->recipient($shipment->current_logistics_organization_id, $shipment->current_hub_id);
        if ($recipient === null) {
            return;
        }

        $this->dispatch($recipient, 'logistics-completion.requested', "completion:{$intent->id}", $intent->confirmed_at ?? $intent->created_at, [
            'completion_intent_id' => $intent->id,
            'task_id' => $task->id,
            'title' => 'Delivery completion requested',
            'summary' => 'A Courier requested delivery completion validation.',
            'resource_type' => 'completion_intent',
            'resource_id' => $intent->id,
        ]);
    }

    /** @param list<string> $changedFields */
    private function deliverVehicleUpdated(string $vehicleId, string $courierId, int $revision, array $changedFields): void
    {
        $affiliation = CourierLogisticsAffiliation::query()
            ->where('courier_id', $courierId)
            ->where('status', 'approved')
            ->first();
        if ($affiliation === null) {
            return;
        }
        $recipient = $this->recipient($affiliation->logistics_organization_id, $affiliation->logistics_hub_id);
        if ($recipient === null) {
            return;
        }

        $this->dispatch($recipient, 'logistics-courier.vehicle-updated', "vehicle:{$vehicleId}:revision:{$revision}", now(), [
            'vehicle_id' => $vehicleId,
            'courier_id' => $courierId,
            'revision' => $revision,
            'changed_fields' => array_values(array_unique($changedFields)),
            'updated_at' => now()->utc()->toIso8601String(),
            'title' => 'Courier vehicle updated',
            'summary' => 'An affiliated Courier updated vehicle details or registration evidence.',
            'resource_type' => 'courier_vehicle',
            'resource_id' => $vehicleId,
        ]);
    }

    /** @param Carbon|null $eventAt @param array<string, mixed> $payload */
    private function dispatch(User $recipient, string $type, string $sourceKey, ?Carbon $eventAt, array $payload): void
    {
        $arguments = [
            (string) $recipient->id,
            $type,
            $sourceKey,
            ($eventAt ?? now())->utc()->toDateTimeString(),
            $payload,
        ];

        try {
            DeliverLogisticsNotification::dispatch(...$arguments);
        } catch (Throwable $exception) {
            // Queue infrastructure may be unavailable even though the source
            // transaction committed. Complete the inbox write synchronously
            // as a best-effort fallback so an operational action is never
            // reported as failed merely because dispatch could not be queued.
            report($exception);
            try {
                DeliverLogisticsNotification::dispatchSync(...$arguments);
            } catch (Throwable $fallback) {
                report($fallback);
            }
        }
    }

    private function afterCommit(\Closure $callback): void
    {
        DB::afterCommit(function () use ($callback): void {
            try {
                $callback();
            } catch (Throwable $exception) {
                report($exception);
            }
        });
    }

    private function recipient(string $organizationId, ?string $hubId): ?User
    {
        if ($hubId === null) {
            return null;
        }

        return User::query()
            ->where('role', UserRole::Logistics)
            ->where('status', UserStatus::Active)
            ->whereHas('logisticsOrganization', fn ($query) => $query
                ->whereKey($organizationId)
                ->whereHas('hub', fn ($hub) => $hub->whereKey($hubId)))
            ->first();
    }

    /** @return array{resource_type: string|null, resource_id: string|null, destination: string|null} */
    private function context(string $type, array $data, User $logistics): array
    {
        $org = $logistics->logisticsOrganization()->with('hub')->first();
        if (! $org?->hub) {
            return $this->emptyContext();
        }
        $orgId = (string) $org->id;
        $hubId = (string) $org->hub->id;

        return match ($type) {
            'logistics-pickup.requested' => $this->pickupContext($data, $orgId, $hubId),
            'logistics-courier.application-pending' => $this->affiliationContext($data, $orgId, $hubId),
            'logistics-task.offer-rejected' => $this->taskContext($data, $orgId, $hubId),
            'logistics-evidence.submitted' => $this->evidenceContext($data, $orgId, $hubId),
            'logistics-completion.requested' => $this->completionContext($data, $orgId, $hubId),
            'logistics-courier.vehicle-updated' => $this->vehicleContext($data, $orgId, $hubId),
            'logistics-linehaul.receiving-discrepancies' => $this->linehaulDiscrepancyContext($data, $orgId, $hubId),
            'logistics-linehaul.return-scheduled' => $this->linehaulContext($data, $orgId, $hubId),
            default => $this->emptyContext(),
        };
    }

    /** @return array{resource_type: string|null, resource_id: string|null, destination: string|null} */
    private function pickupContext(array $data, string $orgId, string $hubId): array
    {
        $id = $this->uuid($data['pickup_request_id'] ?? $data['resource_id'] ?? null);
        $pickup = $id === null ? null : SellerPickupRequest::query()->whereKey($id)->where('logistics_organization_id', $orgId)->where('logistics_hub_id', $hubId)->first();

        return $pickup ? $this->known('pickup_request', $pickup->id, "/pickups/{$pickup->id}") : $this->emptyContext();
    }

    /** @return array{resource_type: string|null, resource_id: string|null, destination: string|null} */
    private function affiliationContext(array $data, string $orgId, string $hubId): array
    {
        $id = $this->uuid($data['affiliation_id'] ?? $data['courier_affiliation_id'] ?? $data['resource_id'] ?? null);
        $affiliation = $id === null ? null : CourierLogisticsAffiliation::query()->whereKey($id)->where('logistics_organization_id', $orgId)->where('logistics_hub_id', $hubId)->first();

        return $affiliation ? $this->known('courier_affiliation', $affiliation->id, "/courier-applications/{$affiliation->id}") : $this->emptyContext();
    }

    /** @return array{resource_type: string|null, resource_id: string|null, destination: string|null} */
    private function taskContext(array $data, string $orgId, string $hubId): array
    {
        $id = $this->uuid($data['task_id'] ?? $data['delivery_task_id'] ?? $data['resource_id'] ?? null);
        $task = $this->scopedTask($id, $orgId, $hubId);

        return $task ? $this->taskKnown($task) : $this->emptyContext();
    }

    /** @return array{resource_type: string|null, resource_id: string|null, destination: string|null} */
    private function evidenceContext(array $data, string $orgId, string $hubId): array
    {
        $id = $this->uuid($data['evidence_id'] ?? $data['shipment_evidence_id'] ?? $data['resource_id'] ?? null);
        $evidence = $id === null ? null : ShipmentEvidence::query()->whereKey($id)->whereHas('task.shipment', fn ($query) => $query->where('current_logistics_organization_id', $orgId)->where('current_hub_id', $hubId))->with('task.shipment.parcel.waybill')->first();

        return $evidence ? $this->taskKnown($evidence->task, 'shipment_evidence', $evidence->id) : $this->emptyContext();
    }

    /** @return array{resource_type: string|null, resource_id: string|null, destination: string|null} */
    private function completionContext(array $data, string $orgId, string $hubId): array
    {
        $id = $this->uuid($data['completion_intent_id'] ?? $data['intent_id'] ?? $data['resource_id'] ?? null);
        $intent = $id === null ? null : CompletionIntent::query()->whereKey($id)->whereHas('task.shipment', fn ($query) => $query->where('current_logistics_organization_id', $orgId)->where('current_hub_id', $hubId))->with('task.shipment.parcel.waybill')->first();

        return $intent ? $this->taskKnown($intent->task, 'completion_intent', $intent->id) : $this->emptyContext();
    }

    /** @return array{resource_type: string|null, resource_id: string|null, destination: string|null} */
    private function vehicleContext(array $data, string $orgId, string $hubId): array
    {
        $id = $this->uuid($data['courier_id'] ?? null);
        $affiliation = $id === null ? null : CourierLogisticsAffiliation::query()
            ->where('courier_id', $id)
            ->where('logistics_organization_id', $orgId)
            ->where('logistics_hub_id', $hubId)
            ->where('status', 'approved')
            ->first();

        return $affiliation ? $this->known('courier_vehicle', (string) ($data['vehicle_id'] ?? $data['resource_id'] ?? ''), "/couriers/{$id}/vehicle") : $this->emptyContext();
    }

    /** @return array{resource_type: string|null, resource_id: string|null, destination: string|null} */
    private function linehaulContext(array $data, string $orgId, string $hubId): array
    {
        $id = $this->uuid($data['trip_id'] ?? null);
        $trip = $id === null ? null : LinehaulTrip::query()->whereKey($id)->where('owner_logistics_organization_id', $orgId)->where('home_hub_id', $hubId)->first();

        return $trip ? $this->known('linehaul_trip', $trip->id, '/dispatch') : $this->emptyContext();
    }

    private function linehaulDiscrepancyContext(array $data, string $orgId, string $hubId): array
    {
        $id = $this->uuid($data['trip_id'] ?? null);
        $trip = $id === null ? null : LinehaulTrip::whereKey($id)->where('from_hub_id', $hubId)
            ->whereHas('fromHub', fn ($query) => $query->where('logistics_organization_id', $orgId))->first();

        return $trip ? $this->known('linehaul_trip', $trip->id, '/linehaul-dispatch') : $this->emptyContext();
    }

    private function scopedTask(?string $id, string $orgId, string $hubId): ?DeliveryTask
    {
        return $id === null ? null : DeliveryTask::query()->whereKey($id)->whereHas('shipment', fn ($query) => $query->where('current_logistics_organization_id', $orgId)->where('current_hub_id', $hubId))->with('shipment.parcel.waybill')->first();
    }

    /** @return array{resource_type: string|null, resource_id: string|null, destination: string|null} */
    private function taskKnown(?DeliveryTask $task, string $type = 'delivery_task', ?string $id = null): array
    {
        if (! $task) {
            return $this->emptyContext();
        }
        $reference = $task->shipment?->parcel?->waybill?->reference ?? $task->shipment?->parcel?->reference;
        $destination = $reference ? '/operations?reference='.rawurlencode((string) $reference) : null;

        return $this->known($type, $id ?? $task->id, $destination);
    }

    /** @return array{resource_type: string|null, resource_id: string|null, destination: string|null} */
    private function known(string $type, string $id, ?string $destination): array
    {
        return ['resource_type' => $type, 'resource_id' => $id, 'destination' => $destination];
    }

    /** @return array{resource_type: null, resource_id: null, destination: null} */
    private function emptyContext(): array
    {
        return ['resource_type' => null, 'resource_id' => null, 'destination' => null];
    }

    /** @return array{0: string, 1: string} */
    private function copy(string $type, array $data): array
    {
        $fallback = match ($type) {
            'logistics-pickup.requested' => ['New pickup request', $this->pickupSummary($data)],
            'logistics-courier.application-pending' => ['Courier application pending', 'A Courier application is waiting for your review.'],
            'logistics-task.offer-rejected' => ['Final-mile offer rejected', 'A Courier rejected a final-mile offer and the task can be re-offered.'],
            'logistics-evidence.submitted' => ['Evidence submitted', $this->evidenceSummary($data)],
            'logistics-completion.requested' => ['Delivery completion requested', 'A Courier requested delivery completion validation.'],
            'logistics-courier.vehicle-updated' => ['Courier vehicle updated', 'An affiliated Courier updated vehicle details or registration evidence.'],
            'logistics-linehaul.receiving-discrepancies' => ['Linehaul receiving discrepancies', 'The receiving hub closed unloading with recorded parcel discrepancies.'],
            'logistics-linehaul.return-scheduled' => ['Return linehaul scheduled', 'The receiving Logistics partner scheduled your driver and truck to return home.'],
            default => ['Notification', 'An update is available.'],
        };

        return [$this->text($data['title'] ?? null, $fallback[0], 120), $this->text($data['summary'] ?? null, $fallback[1], 240)];
    }

    private function pickupSummary(array $data): string
    {
        $count = is_numeric($data['order_count'] ?? null) ? min(10000, max(0, (int) $data['order_count'])) : null;

        return $count === null ? 'A Seller requested a pickup.' : "A Seller requested pickup for {$count} ".($count === 1 ? 'Order.' : 'Orders.');
    }

    private function evidenceSummary(array $data): string
    {
        $purpose = $this->text($data['purpose'] ?? null, 'evidence', 50);
        $label = $purpose === 'hub_pickup' ? 'hub-pickup evidence' : ($purpose === 'delivery_proof' ? 'delivery proof' : 'evidence');

        return "New {$label} is waiting for Logistics validation.";
    }

    private function text(mixed $value, string $fallback, int $limit): string
    {
        if (! is_string($value) || trim($value) === '') {
            return $fallback;
        }
        $plain = preg_replace('/\s+/u', ' ', trim(strip_tags($value))) ?? '';

        return $plain === '' ? $fallback : Str::limit($plain, $limit, '');
    }

    private function value(mixed $value, int $limit): ?string
    {
        return is_string($value) && $value !== '' ? Str::limit($value, $limit, '') : null;
    }

    private function uuid(mixed $value): ?string
    {
        return is_string($value) && Str::isUuid($value) ? $value : null;
    }

    private function utc(mixed $value): ?string
    {
        return $value instanceof \DateTimeInterface ? Carbon::instance($value)->utc()->toIso8601String() : null;
    }

    /** @return array<string, mixed> */
    private function data(mixed $data): array
    {
        if (is_array($data)) {
            return $data;
        }
        if (! is_string($data) || trim($data) === '') {
            return [];
        }
        try {
            $decoded = json_decode($data, true, 32, JSON_THROW_ON_ERROR);

            return is_array($decoded) ? $decoded : [];
        } catch (Throwable) {
            return [];
        }
    }
}
