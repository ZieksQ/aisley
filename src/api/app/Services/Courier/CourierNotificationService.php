<?php

namespace App\Services\Courier;

use App\Enums\CourierAffiliationStatus;
use App\Enums\FulfillmentOfferStatus;
use App\Enums\FulfillmentTaskLeg;
use App\Enums\FulfillmentTaskStatus;
use App\Enums\PickupScheduleStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Jobs\Courier\DeliverCourierNotification;
use App\Models\DeliveryTaskOffer;
use App\Models\LinehaulTrip;
use App\Models\PickupSchedule;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class CourierNotificationService
{
    /** @var list<string> */
    public const TYPES = [
        'pickup-schedule.assigned',
        'pickup-schedule.revised',
        'pickup-schedule.cancelled',
        'pickup-schedule.reminder',
        'courier-task.final-mile-offered',
        'courier-linehaul.trip-scheduled',
    ];

    /** @return MorphMany<DatabaseNotification> */
    public function query(User $courier): MorphMany
    {
        return $courier->notifications()->whereIn('type', self::TYPES);
    }

    /** @return array{organization_id: string, hub_id: string}|null */
    public function scope(User $courier): ?array
    {
        if ($courier->role !== UserRole::Courier || $courier->status !== UserStatus::Active) {
            return null;
        }

        $affiliation = $courier->courierLogisticsAffiliation()->with('organization.user', 'organization.hub', 'hub')->first();
        if ($affiliation === null
            || $affiliation->status !== CourierAffiliationStatus::Approved
            || $affiliation->organization?->user?->status !== UserStatus::Active
            || $affiliation->hub === null
            || (string) $affiliation->organization?->hub?->id !== (string) $affiliation->logistics_hub_id) {
            return null;
        }

        return [
            'organization_id' => (string) $affiliation->logistics_organization_id,
            'hub_id' => (string) $affiliation->logistics_hub_id,
        ];
    }

    /** @return array{data: list<array<string, mixed>>, meta: array<string, mixed>} */
    public function list(User $courier, string $status, int $limit, ?string $cursor): array
    {
        $query = $this->query($courier)
            ->when($status === 'unread', fn (Builder $builder) => $builder->whereNull('read_at'))
            ->when($status === 'read', fn (Builder $builder) => $builder->whereNotNull('read_at'))
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if ($cursor !== null) {
            [$createdAt, $id] = $this->decodeCursor($cursor, $courier, $status);
            $query->where(function (Builder $builder) use ($createdAt, $id): void {
                $builder->where('created_at', '<', $createdAt)
                    ->orWhere(fn (Builder $sameTime) => $sameTime
                        ->where('created_at', $createdAt)
                        ->where('id', '<', $id));
            });
        }

        $records = $query->limit($limit + 1)->get();
        $hasNext = $records->count() > $limit;
        $items = $records->take($limit);
        $last = $items->last();

        return [
            'data' => $items->map(fn (DatabaseNotification $notification): array => $this->project($notification, $courier))->values()->all(),
            'meta' => [
                'next_cursor' => $hasNext && $last instanceof DatabaseNotification
                    ? $this->encodeCursor($last, $courier, $status)
                    : null,
                'generated_at' => now()->utc()->toISOString(),
            ],
        ];
    }

    /** @return array<string, mixed> */
    public function project(DatabaseNotification $notification, User $courier): array
    {
        $data = $this->data($notification->data);
        $scope = $this->scope($courier);
        $context = $scope === null
            ? $this->emptyContext()
            : match ($notification->type) {
                'pickup-schedule.assigned', 'pickup-schedule.revised', 'pickup-schedule.cancelled', 'pickup-schedule.reminder' => $this->scheduleContext($data, $notification->type, $courier, $scope),
                'courier-task.final-mile-offered' => $this->finalOfferContext($data, $courier, $scope),
                'courier-linehaul.trip-scheduled' => $this->linehaulContext($data, $courier),
                default => $this->emptyContext(),
            };

        return [
            'id' => (string) $notification->id,
            'type' => (string) $notification->type,
            'title' => $context['title'],
            'summary' => $context['summary'],
            'read_at' => $this->utc($notification->read_at),
            'created_at' => $this->utc($notification->created_at),
            'resource_type' => $context['resource_type'],
            'resource_id' => $context['resource_id'],
            'destination' => $context['destination'],
        ];
    }

    public function markRead(User $courier, string $notification): DatabaseNotification
    {
        return DB::transaction(function () use ($courier, $notification): DatabaseNotification {
            $record = $this->query($courier)->whereKey($notification)->lockForUpdate()->firstOrFail();
            if ($record->read_at === null) {
                $record->read_at = now();
                $record->save();
            }

            return $record->fresh();
        }, 3);
    }

    public function queuePickupSchedule(PickupSchedule|string $schedule, string $event, ?string $sourceKey = null, ?Carbon $eventAt = null): void
    {
        $scheduleId = $schedule instanceof PickupSchedule ? (string) $schedule->id : $schedule;
        $this->afterCommit(function () use ($scheduleId, $event, $sourceKey, $eventAt): void {
            $record = PickupSchedule::query()->whereKey($scheduleId)->first();
            if ($record === null) {
                return;
            }
            $affiliation = $this->approvedAffiliation($record->courier_id, $record->logistics_organization_id, $record->logistics_hub_id);
            if ($affiliation === null) {
                return;
            }
            $key = $sourceKey ?? "schedule:{$record->id}:revision:{$record->revision}:event:{$event}";
            $schedulePayload = $this->schedulePayload($record);
            $this->dispatch(
                $record->courier_id,
                'pickup-schedule.'.$event,
                $key,
                $eventAt ?? $record->updated_at ?? now(),
                array_merge([
                    'schedule_id' => (string) $record->id,
                    'reference' => (string) $record->reference,
                    'revision' => (int) $record->revision,
                    'event' => $event,
                    'starts_at' => $record->starts_at?->toISOString(),
                    'ends_at' => $record->ends_at?->toISOString(),
                    'logistics_organization_id' => (string) $affiliation->logistics_organization_id,
                    'logistics_hub_id' => (string) $affiliation->logistics_hub_id,
                ], $schedulePayload),
            );
        });
    }

    public function queueFinalMileOffer(DeliveryTaskOffer|string $offer): void
    {
        $offerId = $offer instanceof DeliveryTaskOffer ? (string) $offer->id : $offer;
        $this->afterCommit(fn () => $this->deliverFinalMileOffer($offerId));
    }

    public function queueLinehaulTrip(LinehaulTrip|string $trip): void
    {
        $tripId = $trip instanceof LinehaulTrip ? (string) $trip->id : $trip;
        $this->afterCommit(function () use ($tripId): void {
            $record = LinehaulTrip::query()->whereKey($tripId)->first();
            if ($record === null) {
                return;
            }
            $this->dispatch($record->driver_id, 'courier-linehaul.trip-scheduled', "linehaul:{$record->id}:revision:{$record->revision}", $record->updated_at, [
                'trip_id' => $record->id,
                'logistics_organization_id' => $record->owner_logistics_organization_id,
                'logistics_hub_id' => $record->home_hub_id,
                'title' => 'Linehaul trip scheduled',
                'summary' => 'A company-truck linehaul trip was scheduled for you.',
            ]);
        });
    }

    /** @return array{title: string, summary: string, resource_type: string|null, resource_id: string|null, destination: string|null} */
    private function linehaulContext(array $data, User $courier): array
    {
        $id = $this->uuid($data['trip_id'] ?? null);
        $trip = $id === null ? null : LinehaulTrip::query()->whereKey($id)->where('driver_id', $courier->id)->first();

        return $trip ? [
            'title' => 'Linehaul trip scheduled',
            'summary' => 'A company-truck linehaul trip was scheduled for you.',
            'resource_type' => 'linehaul_trip',
            'resource_id' => (string) $trip->id,
            'destination' => "/linehaul-trips/{$trip->id}",
        ] : $this->emptyContext();
    }

    /** @return array{title: string, summary: string, resource_type: string|null, resource_id: string|null, destination: string|null} */
    private function scheduleContext(array $data, string $type, User $courier, array $scope): array
    {
        $id = $this->uuid($data['schedule_id'] ?? $data['resource_id'] ?? null);
        $schedule = $id === null ? null : PickupSchedule::query()
            ->whereKey($id)
            ->where('courier_id', $courier->id)
            ->where('logistics_organization_id', $scope['organization_id'])
            ->where('logistics_hub_id', $scope['hub_id'])
            ->first();
        if ($schedule === null) {
            return $this->emptyContext();
        }

        $reference = $this->text($schedule->reference, 'your pickup schedule', 80);
        $window = $this->window($schedule);
        $copy = match ($type) {
            'pickup-schedule.assigned' => ['Pickup scheduled', "Pickup schedule {$reference} is set for {$window}."],
            'pickup-schedule.revised' => ['Pickup schedule updated', "Pickup schedule {$reference} was moved to {$window}."],
            'pickup-schedule.cancelled' => ['Pickup schedule cancelled', "Pickup schedule {$reference} was cancelled."],
            default => ['Pickup starts in one hour', "Pickup schedule {$reference} starts at {$schedule->starts_at->timezone('Asia/Manila')->format('g:i A')} PHT."],
        };

        return [
            'title' => $copy[0],
            'summary' => $copy[1],
            'resource_type' => 'pickup_schedule',
            'resource_id' => (string) $schedule->id,
            'destination' => $type === 'pickup-schedule.cancelled' || $schedule->status === PickupScheduleStatus::Cancelled
                ? null
                : "/pickup-schedules/{$schedule->id}",
        ];
    }

    /** @return array{title: string, summary: string, resource_type: string|null, resource_id: string|null, destination: string|null} */
    private function finalOfferContext(array $data, User $courier, array $scope): array
    {
        $id = $this->uuid($data['offer_id'] ?? null);
        $offer = $id === null ? null : DeliveryTaskOffer::query()
            ->whereKey($id)
            ->where('courier_id', $courier->id)
            ->where('logistics_organization_id', $scope['organization_id'])
            ->with('task.shipment')
            ->first();
        $task = $offer?->task;
        $shipment = $task?->shipment;
        $available = $offer !== null
            && $offer->status === FulfillmentOfferStatus::Offered
            && $task?->leg === FulfillmentTaskLeg::FinalMile
            && $task->status === FulfillmentTaskStatus::DeliveryAssigned
            && (string) $task->courier_id === (string) $courier->id
            && (string) $shipment?->current_logistics_organization_id === $scope['organization_id']
            && (string) $shipment?->current_hub_id === $scope['hub_id'];
        if (! $available) {
            return $this->emptyContext();
        }

        return [
            'title' => 'New delivery request',
            'summary' => 'A final-mile delivery request is available.',
            'resource_type' => 'delivery_task',
            'resource_id' => (string) $task->id,
            'destination' => "/final-mile-tasks/{$task->id}",
        ];
    }

    private function deliverFinalMileOffer(string $id): void
    {
        $offer = DeliveryTaskOffer::query()->whereKey($id)->with('task.shipment')->first();
        $task = $offer?->task;
        $shipment = $task?->shipment;
        if ($offer === null || $task === null || $shipment === null || $offer->courier_id === null) {
            return;
        }
        $affiliation = $this->approvedAffiliation($offer->courier_id, $offer->logistics_organization_id, $shipment->current_hub_id);
        if ($affiliation === null) {
            return;
        }

        $this->dispatch(
            $offer->courier_id,
            'courier-task.final-mile-offered',
            "offer:{$offer->id}",
            $offer->offered_at ?? $offer->created_at ?? now(),
            [
                'offer_id' => (string) $offer->id,
                'task_id' => (string) $task->id,
                'logistics_organization_id' => (string) $affiliation->logistics_organization_id,
                'logistics_hub_id' => (string) $affiliation->logistics_hub_id,
            ],
        );
    }

    /** @return array<string, mixed> */
    private function schedulePayload(PickupSchedule $schedule): array
    {
        $addresses = $schedule->orders()->with('order.waybill.snapshot')->get()
            ->map(fn ($scheduleOrder): mixed => $scheduleOrder->order?->waybill?->snapshot?->payload['pickup'] ?? null)
            ->filter(fn (mixed $address): bool => is_array($address));
        $keys = $addresses->map(fn (array $address): string => implode('|', [
            $address['address_line_1'] ?? '',
            $address['barangay'] ?? '',
            $address['city_municipality'] ?? '',
            $address['province'] ?? '',
            $address['latitude'] ?? '',
            $address['longitude'] ?? '',
        ]))->unique();
        $first = $addresses->first();

        return [
            'order_count' => $schedule->orders()->count(),
            'pickup_stop_count' => $keys->count(),
            'pickup_area' => $keys->count() === 1 && is_array($first) ? [
                'city_municipality' => $first['city_municipality'] ?? null,
                'province' => $first['province'] ?? null,
                'region' => $first['region'] ?? null,
            ] : null,
        ];
    }

    private function approvedAffiliation(string $courierId, string $organizationId, ?string $hubId): ?object
    {
        if ($hubId === null) {
            return null;
        }

        return User::query()->whereKey($courierId)
            ->where('role', UserRole::Courier->value)
            ->where('status', UserStatus::Active->value)
            ->whereHas('courierLogisticsAffiliation', fn (Builder $query) => $query
                ->where('logistics_organization_id', $organizationId)
                ->where('logistics_hub_id', $hubId)
                ->where('status', CourierAffiliationStatus::Approved->value))
            ->whereHas('courierLogisticsAffiliation.organization', fn (Builder $query) => $query
                ->whereHas('user', fn (Builder $owner) => $owner->where('status', UserStatus::Active->value))
                ->whereHas('hub', fn (Builder $hub) => $hub->whereKey($hubId)))
            ->with('courierLogisticsAffiliation')
            ->first()?->courierLogisticsAffiliation;
    }

    /** @param Carbon|\DateTimeInterface|string|null $eventAt @param array<string, mixed> $payload */
    private function dispatch(string $recipientId, string $type, string $sourceKey, Carbon|\DateTimeInterface|string|null $eventAt, array $payload): void
    {
        $arguments = [
            $recipientId,
            $type,
            $sourceKey,
            CarbonImmutable::parse($eventAt ?? now())->utc()->toDateTimeString(),
            $payload,
        ];

        try {
            DeliverCourierNotification::dispatch(...$arguments);
        } catch (Throwable $exception) {
            report($exception);
            try {
                DeliverCourierNotification::dispatchSync(...$arguments);
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

    /** @return array{title: string, summary: string, resource_type: null, resource_id: null, destination: null} */
    private function emptyContext(): array
    {
        return ['title' => 'Notification', 'summary' => 'An update is available.', 'resource_type' => null, 'resource_id' => null, 'destination' => null];
    }

    private function window(PickupSchedule $schedule): string
    {
        $starts = $schedule->starts_at->timezone('Asia/Manila');
        $ends = $schedule->ends_at->timezone('Asia/Manila');

        return $starts->format('M j, Y g:i A').'–'.$ends->format('g:i A').' PHT';
    }

    private function text(mixed $value, string $fallback, int $limit): string
    {
        if (! is_string($value) || trim($value) === '') {
            return $fallback;
        }

        return Str::limit(trim(strip_tags($value)), $limit, '');
    }

    private function uuid(mixed $value): ?string
    {
        return is_string($value) && Str::isUuid($value) ? $value : null;
    }

    private function utc(mixed $value): ?string
    {
        return $value instanceof \DateTimeInterface ? Carbon::instance($value)->utc()->toIso8601String() : null;
    }

    /** @return array{0: string, 1: string} */
    private function decodeCursor(string $cursor, User $courier, string $status): array
    {
        $encoded = strtr($cursor, '-_', '+/');
        $encoded .= str_repeat('=', (4 - strlen($encoded) % 4) % 4);
        $decoded = base64_decode($encoded, true);
        $payload = is_string($decoded) ? json_decode($decoded, true) : null;
        $scope = $this->cursorScope($courier, $status);
        $signature = is_array($payload) ? ($payload['signature'] ?? null) : null;
        $unsigned = is_array($payload) ? ($payload['unsigned'] ?? null) : null;
        $valid = is_array($unsigned)
            && is_string($signature)
            && hash_equals(hash_hmac('sha256', json_encode($unsigned, JSON_THROW_ON_ERROR), (string) config('app.key')), $signature)
            && ($unsigned['scope'] ?? null) === $scope
            && is_string($unsigned['id'] ?? null)
            && Str::isUuid($unsigned['id'])
            && is_string($unsigned['created_at'] ?? null);
        if (! $valid) {
            throw ValidationException::withMessages(['cursor' => ['The notification cursor is invalid or expired.']]);
        }

        try {
            $createdAt = CarbonImmutable::parse($unsigned['created_at'])->utc()->toDateTimeString();
        } catch (Throwable) {
            throw ValidationException::withMessages(['cursor' => ['The notification cursor is invalid or expired.']]);
        }

        return [$createdAt, $unsigned['id']];
    }

    private function encodeCursor(DatabaseNotification $notification, User $courier, string $status): string
    {
        $unsigned = [
            'scope' => $this->cursorScope($courier, $status),
            'created_at' => CarbonImmutable::instance($notification->created_at)->utc()->toISOString(),
            'id' => (string) $notification->id,
        ];
        $payload = ['unsigned' => $unsigned, 'signature' => hash_hmac('sha256', json_encode($unsigned, JSON_THROW_ON_ERROR), (string) config('app.key'))];

        return rtrim(strtr(base64_encode(json_encode($payload, JSON_THROW_ON_ERROR)), '+/', '-_'), '=');
    }

    private function cursorScope(User $courier, string $status): string
    {
        return hash('sha256', implode('|', [(string) $courier->id, $status, implode(',', self::TYPES)]));
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
