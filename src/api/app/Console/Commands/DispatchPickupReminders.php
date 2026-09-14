<?php

namespace App\Console\Commands;

use App\Enums\PickupScheduleStatus;
use App\Models\PickupScheduleReminder;
use App\Models\SellerPickupRequestOrder;
use App\Models\User;
use App\Notifications\PickupScheduleNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class DispatchPickupReminders extends Command
{
    protected $signature = 'pickups:dispatch-reminders {--limit=50}';

    protected $description = 'Dispatch due first-mile pickup reminders idempotently';

    public function handle(): int
    {
        $limit = max(1, min((int) $this->option('limit'), 200));
        $ids = PickupScheduleReminder::query()->where('status', 'pending')->where('due_at', '<=', now())->orderBy('due_at')->limit($limit)->pluck('id');
        foreach ($ids as $id) {
            $reminder = DB::transaction(function () use ($id) {
                $candidate = PickupScheduleReminder::query()->whereKey($id)->first();
                if (! $candidate) {
                    return null;
                }
                $schedule = $candidate->schedule()->lockForUpdate()->first();
                $record = PickupScheduleReminder::query()->whereKey($id)->lockForUpdate()->first();
                if (! $record || $record->status !== 'pending' || $record->due_at->isFuture()) {
                    return null;
                }
                if (! $schedule || $schedule->status !== PickupScheduleStatus::Scheduled || $schedule->revision !== $record->schedule_revision) {
                    $record->update(['status' => 'suppressed']);

                    return null;
                }
                $record->update(['status' => 'processing', 'claimed_at' => now(), 'attempts' => $record->attempts + 1]);

                return $record->fresh(['schedule.courier']);
            });
            if (! $reminder) {
                continue;
            }
            try {
                $schedule = $reminder->schedule;
                $schedule->courier?->notify(new PickupScheduleNotification($schedule, 'reminder'));
                $shopIds = SellerPickupRequestOrder::query()->whereIn('order_id', $schedule->orders()->pluck('order_id'))->join('seller_pickup_requests', 'seller_pickup_requests.id', '=', 'seller_pickup_request_orders.seller_pickup_request_id')->pluck('seller_pickup_requests.shop_id');
                User::query()->whereHas('shop', fn ($q) => $q->whereIn('id', $shopIds))->eachById(fn (User $seller) => $seller->notify(new PickupScheduleNotification($schedule, 'reminder')));
                DB::transaction(function () use ($reminder): void {
                    $candidate = PickupScheduleReminder::query()->whereKey($reminder->id)->first();
                    if (! $candidate) {
                        return;
                    }
                    $schedule = $candidate->schedule()->lockForUpdate()->first();
                    $record = PickupScheduleReminder::query()->whereKey($reminder->id)->lockForUpdate()->first();
                    if (! $record || $record->status !== 'processing') {
                        return;
                    }
                    if (! $schedule || $schedule->status !== PickupScheduleStatus::Scheduled || $schedule->revision !== $record->schedule_revision) {
                        $record->update(['status' => 'suppressed']);

                        return;
                    }
                    $record->update(['status' => 'sent', 'sent_at' => now(), 'last_error' => null]);
                });
            } catch (\Throwable $exception) {
                report($exception);
                DB::transaction(function () use ($reminder, $exception): void {
                    $candidate = PickupScheduleReminder::query()->whereKey($reminder->id)->first();
                    if (! $candidate) {
                        return;
                    }
                    $schedule = $candidate->schedule()->lockForUpdate()->first();
                    $record = PickupScheduleReminder::query()->whereKey($reminder->id)->lockForUpdate()->first();
                    if (! $record || $record->status !== 'processing') {
                        return;
                    }
                    $record->update(['status' => 'pending', 'failed_at' => now(), 'last_error' => mb_substr($exception->getMessage(), 0, 1000), 'due_at' => now()->addMinutes(min(30, 2 ** min($record->attempts, 5)))]);
                });
            }
        }

        return self::SUCCESS;
    }
}
