<?php

namespace App\Console\Commands;

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
                $record = PickupScheduleReminder::query()->whereKey($id)->lockForUpdate()->first();
                if (! $record || $record->status !== 'pending' || $record->due_at->isFuture()) {
                    return null;
                }
                $record->update(['status' => 'processing', 'claimed_at' => now(), 'attempts' => $record->attempts + 1]);

                return $record->fresh('schedule.courier');
            });
            if (! $reminder) {
                continue;
            }
            try {
                $schedule = $reminder->schedule;
                $schedule->courier?->notify(new PickupScheduleNotification($schedule, 'reminder'));
                $shopIds = SellerPickupRequestOrder::query()->whereIn('order_id', $schedule->orders()->pluck('order_id'))->join('seller_pickup_requests', 'seller_pickup_requests.id', '=', 'seller_pickup_request_orders.seller_pickup_request_id')->pluck('seller_pickup_requests.shop_id');
                User::query()->whereHas('shop', fn ($q) => $q->whereIn('id', $shopIds))->eachById(fn (User $seller) => $seller->notify(new PickupScheduleNotification($schedule, 'reminder')));
                $reminder->update(['status' => 'sent', 'sent_at' => now(), 'last_error' => null]);
            } catch (\Throwable $exception) {
                report($exception);
                $reminder->update(['status' => 'pending', 'failed_at' => now(), 'last_error' => mb_substr($exception->getMessage(), 0, 1000), 'due_at' => now()->addMinutes(min(30, 2 ** min($reminder->attempts, 5)))]);
            }
        }

        return self::SUCCESS;
    }
}
