<?php

namespace App\Services\Logistics;

use App\Enums\CourierAffiliationStatus;
use App\Enums\FirstMileTaskStatus;
use App\Enums\PickupRouteManifestStatus;
use App\Enums\PickupScheduleStatus;
use App\Enums\UserStatus;
use App\Exceptions\Logistics\LogisticsPickupException;
use App\Jobs\BuildPickupRouteManifestJob;
use App\Models\CourierLogisticsAffiliation;
use App\Models\LogisticsOrganization;
use App\Models\PickupRouteManifest;
use App\Models\PickupSchedule;
use App\Models\PickupScheduleHistory;
use App\Models\SellerPickupRequest;
use App\Models\SellerPickupRequestOrder;
use App\Models\User;
use App\Notifications\PickupScheduleNotification;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PickupScheduleService
{
    public function create(User $logistics, array $data, string $key): PickupSchedule
    {
        $org = $logistics->logisticsOrganization()->with('hub')->firstOrFail();
        try {
            return DB::transaction(function () use ($logistics, $org, $data, $key): PickupSchedule {
                $org = LogisticsOrganization::query()->whereKey($org->id)->with('hub')->lockForUpdate()->firstOrFail();
                $previous = PickupSchedule::query()->where('logistics_organization_id', $org->id)->where('idempotency_key', $key)->with('orders')->first();
                if ($previous) {
                    $same = $previous->orders->pluck('order_id')->sort()->values()->all() === collect($data['order_ids'])->sort()->values()->all()
                        && $previous->courier_id === $data['courier_id']
                        && $previous->starts_at->equalTo(CarbonImmutable::parse($data['starts_at'])->utc())
                        && $previous->ends_at->equalTo(CarbonImmutable::parse($data['ends_at'])->utc());
                    if (! $same) {
                        throw new LogisticsPickupException('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for another schedule.');
                    }

                    return $previous;
                }
                $starts = CarbonImmutable::parse($data['starts_at'])->utc();
                $ends = CarbonImmutable::parse($data['ends_at'])->utc();
                $this->assertWindow($starts, $ends);
                $this->assertCourier($data['courier_id'], $org->id, $org->hub->id);
                $this->assertNoCourierConflict($data['courier_id'], $starts, $ends);
                $links = SellerPickupRequestOrder::query()->whereIn('order_id', $data['order_ids'])
                    ->whereHas('sellerPickupRequest', fn ($query) => $query->where('logistics_organization_id', $org->id))
                    ->whereDoesntHave('order.firstMileTask')->with(['order.waybill', 'sellerPickupRequest'])->orderBy('order_id')->lockForUpdate()->get();
                if ($links->count() !== count($data['order_ids'])) {
                    throw new LogisticsPickupException('PICKUP_ORDERS_UNAVAILABLE', 'One or more Orders are not available for scheduling.');
                }
                if ($links->pluck('sellerPickupRequest.shop_id')->unique()->count() !== 1) {
                    throw new LogisticsPickupException('PICKUP_WINDOW_MIXED_ORIGINS', 'One pickup schedule may contain Orders from only one Shop pickup origin.');
                }

                $schedule = PickupSchedule::create(['logistics_organization_id' => $org->id, 'logistics_hub_id' => $org->hub->id, 'courier_id' => $data['courier_id'], 'reference' => $this->reference(), 'status' => PickupScheduleStatus::Scheduled, 'starts_at' => $starts, 'ends_at' => $ends, 'revision' => 1, 'idempotency_key' => $key]);
                foreach ($links as $link) {
                    if (! $link->order->waybill) {
                        throw new LogisticsPickupException('WAYBILL_MISSING', 'Every scheduled Order must have an active waybill.');
                    }
                    $schedule->orders()->create(['seller_pickup_request_id' => $link->seller_pickup_request_id, 'order_id' => $link->order_id]);
                    $schedule->tasks()->create(['order_id' => $link->order_id, 'waybill_id' => $link->order->waybill->id, 'logistics_organization_id' => $org->id, 'logistics_hub_id' => $org->hub->id, 'courier_id' => $data['courier_id']]);
                }
                PickupRouteManifest::create(['pickup_schedule_id' => $schedule->id, 'schedule_revision' => $schedule->revision, 'status' => PickupRouteManifestStatus::Pending]);
                $this->history($schedule, $logistics, 'created', null, $this->state($schedule), null);
                $this->refreshPickupStatuses($schedule->orders()->pluck('seller_pickup_request_id')->unique()->all());
                $this->replaceReminder($schedule);
                DB::afterCommit(fn () => BuildPickupRouteManifestJob::dispatch($schedule->id, $schedule->revision));
                DB::afterCommit(fn () => $this->notify($schedule, 'assigned'));

                return $schedule->load(['orders', 'tasks']);
            }, 3);
        } catch (QueryException $exception) {
            if ($exception->getCode() === '23505' || str_contains($exception->getMessage(), 'UNIQUE constraint failed')) {
                throw new LogisticsPickupException('SCHEDULE_CONFLICT', 'A competing assignment changed one of the selected Orders.');
            }
            throw $exception;
        }
    }

    public function revise(User $logistics, string $id, array $data): PickupSchedule
    {
        return DB::transaction(function () use ($logistics, $id, $data): PickupSchedule {
            $org = $logistics->logisticsOrganization()->with('hub')->firstOrFail();
            $schedule = PickupSchedule::query()->where('logistics_organization_id', $org->id)->whereKey($id)->lockForUpdate()->firstOrFail();
            if ($schedule->status !== PickupScheduleStatus::Scheduled || $schedule->starts_at->isPast() || $schedule->revision !== (int) $data['expected_revision']) {
                throw new LogisticsPickupException('SCHEDULE_STALE', 'The schedule can no longer be revised with that revision.');
            }
            if ($schedule->tasks()->where('status', '!=', FirstMileTaskStatus::Assigned)->lockForUpdate()->exists()) {
                throw new LogisticsPickupException('SCHEDULE_CUSTODY_STARTED', 'An accepted or picked-up schedule can no longer be revised.');
            }
            $before = $this->state($schedule);
            $starts = isset($data['starts_at']) ? CarbonImmutable::parse($data['starts_at'])->utc() : $schedule->starts_at->toImmutable();
            $ends = isset($data['ends_at']) ? CarbonImmutable::parse($data['ends_at'])->utc() : $schedule->ends_at->toImmutable();
            $courierId = $data['courier_id'] ?? $schedule->courier_id;
            $this->assertWindow($starts, $ends);
            $this->assertCourier($courierId, $org->id, $org->hub->id);
            $this->assertNoCourierConflict($courierId, $starts, $ends, $schedule->id);
            $schedule->update(['courier_id' => $courierId, 'starts_at' => $starts, 'ends_at' => $ends, 'revision' => $schedule->revision + 1]);
            $schedule->tasks()->update(['courier_id' => $courierId]);
            PickupRouteManifest::create(['pickup_schedule_id' => $schedule->id, 'schedule_revision' => $schedule->revision, 'status' => PickupRouteManifestStatus::Pending]);
            $this->history($schedule, $logistics, 'revised', $before, $this->state($schedule), $data['reason']);
            $this->replaceReminder($schedule);
            DB::afterCommit(fn () => BuildPickupRouteManifestJob::dispatch($schedule->id, $schedule->revision));
            DB::afterCommit(fn () => $this->notify($schedule, 'revised'));

            return $schedule->fresh(['orders', 'tasks']);
        }, 3);
    }

    public function cancel(User $logistics, string $id, array $data): PickupSchedule
    {
        return DB::transaction(function () use ($logistics, $id, $data): PickupSchedule {
            $org = $logistics->logisticsOrganization()->firstOrFail();
            $schedule = PickupSchedule::query()->where('logistics_organization_id', $org->id)->whereKey($id)->lockForUpdate()->firstOrFail();
            if ($schedule->status !== PickupScheduleStatus::Scheduled || $schedule->starts_at->isPast() || $schedule->revision !== (int) $data['expected_revision']) {
                throw new LogisticsPickupException('SCHEDULE_STALE', 'The schedule can no longer be cancelled with that revision.');
            }
            if ($schedule->tasks()->where('status', FirstMileTaskStatus::PickedUp)->lockForUpdate()->exists()) {
                throw new LogisticsPickupException('SCHEDULE_CUSTODY_STARTED', 'A schedule with a picked-up parcel can no longer be cancelled.');
            }
            $before = $this->state($schedule);
            $schedule->update(['status' => PickupScheduleStatus::Cancelled, 'revision' => $schedule->revision + 1]);
            $schedule->tasks()->whereIn('status', [FirstMileTaskStatus::Assigned, FirstMileTaskStatus::Accepted])->update(['status' => FirstMileTaskStatus::Cancelled]);
            PickupRouteManifest::create([
                'pickup_schedule_id' => $schedule->id,
                'schedule_revision' => $schedule->revision,
                'status' => PickupRouteManifestStatus::Unavailable,
                'failure_reason' => 'schedule_unavailable',
                'calculated_at' => now(),
            ]);
            $schedule->reminders()->where('status', 'pending')->update(['status' => 'suppressed']);
            $this->refreshPickupStatuses($schedule->orders()->pluck('seller_pickup_request_id')->unique()->all());
            $this->history($schedule, $logistics, 'cancelled', $before, $this->state($schedule), $data['reason']);
            DB::afterCommit(fn () => $this->notify($schedule, 'cancelled'));

            return $schedule->fresh(['orders', 'tasks']);
        }, 3);
    }

    private function assertCourier(string $courierId, string $orgId, string $hubId): void
    {
        $valid = CourierLogisticsAffiliation::query()->where('courier_id', $courierId)->where('logistics_organization_id', $orgId)->where('logistics_hub_id', $hubId)->where('status', CourierAffiliationStatus::Approved)->whereHas('courier', fn ($q) => $q->where('status', UserStatus::Active))->lockForUpdate()->exists();
        if (! $valid) {
            throw new LogisticsPickupException('COURIER_INELIGIBLE', 'The Courier is not an active approved member of this organization and hub.');
        }
    }

    private function assertWindow(CarbonImmutable $starts, CarbonImmutable $ends): void
    {
        if ($starts->isPast() || ! $starts->lessThan($ends)) {
            throw new LogisticsPickupException('PICKUP_WINDOW_INVALID', 'Pickup windows must be future UTC intervals with starts_at before ends_at.', 422);
        }
    }

    private function assertNoCourierConflict(string $courierId, CarbonImmutable $starts, CarbonImmutable $ends, ?string $except = null): void
    {
        $conflict = PickupSchedule::query()->where('courier_id', $courierId)->where('status', PickupScheduleStatus::Scheduled)->when($except, fn ($q) => $q->whereKeyNot($except))->where('starts_at', '<', $ends)->where('ends_at', '>', $starts)->lockForUpdate()->exists();
        if ($conflict) {
            throw new LogisticsPickupException('COURIER_SCHEDULE_CONFLICT', 'The Courier already has an overlapping pickup schedule.');
        }
    }

    private function replaceReminder(PickupSchedule $schedule): void
    {
        $schedule->reminders()->where('status', 'pending')->update(['status' => 'superseded']);
        $due = $schedule->starts_at->copy()->subHour();
        if ($due->isFuture()) {
            $schedule->reminders()->create(['schedule_revision' => $schedule->revision, 'due_at' => $due]);
        }
    }

    private function history(PickupSchedule $schedule, User $actor, string $action, ?array $before, array $after, ?string $reason): void
    {
        PickupScheduleHistory::create(['pickup_schedule_id' => $schedule->id, 'actor_id' => $actor->id, 'action' => $action, 'revision' => $schedule->revision, 'before' => $before, 'after' => $after, 'reason' => $reason, 'occurred_at' => now()]);
    }

    private function state(PickupSchedule $schedule): array
    {
        return ['status' => $schedule->status instanceof PickupScheduleStatus ? $schedule->status->value : $schedule->status, 'courier_id' => $schedule->courier_id, 'starts_at' => $schedule->starts_at->toISOString(), 'ends_at' => $schedule->ends_at->toISOString(), 'revision' => $schedule->revision];
    }

    private function reference(): string
    {
        do {
            $reference = 'PUS-'.strtoupper(Str::random(12));
        } while (PickupSchedule::query()->where('reference', $reference)->exists());

        return $reference;
    }

    private function notify(PickupSchedule $schedule, string $event): void
    {
        try {
            $schedule->courier?->notify(new PickupScheduleNotification($schedule, $event));
            User::query()->whereHas('shop', fn ($q) => $q->whereIn('id', SellerPickupRequestOrder::query()->whereIn('order_id', $schedule->orders()->pluck('order_id'))->join('seller_pickup_requests', 'seller_pickup_requests.id', '=', 'seller_pickup_request_orders.seller_pickup_request_id')->pluck('seller_pickup_requests.shop_id')))->eachById(fn (User $seller) => $seller->notify(new PickupScheduleNotification($schedule, $event)));
        } catch (\Throwable $exception) {
            report($exception);
        }
    }

    private function refreshPickupStatuses(array $pickupIds): void
    {
        foreach ($pickupIds as $pickupId) {
            $pickup = SellerPickupRequest::query()->whereKey($pickupId)->lockForUpdate()->first();
            if (! $pickup) {
                continue;
            }
            $total = $pickup->orders()->count();
            $scheduled = $pickup->orders()->whereHas('order.firstMileTask')->count();
            $pickup->update(['status' => $scheduled === 0 ? 'pending_logistics' : ($scheduled === $total ? 'scheduled' : 'partially_scheduled')]);
        }
    }
}
