<?php

namespace App\Notifications;

use App\Enums\UserRole;
use App\Models\PickupSchedule;
use App\Models\SellerPickupRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class PickupScheduleNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly PickupSchedule $schedule, private readonly string $event)
    {
        $this->afterCommit();
    }

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function databaseType(object $notifiable): string
    {
        return 'pickup-schedule.'.$this->event;
    }

    public function toArray(object $notifiable): array
    {
        $pickup = $this->schedule->orders()->first()?->seller_pickup_request_id;
        $address = $pickup ? SellerPickupRequest::query()->whereKey($pickup)->with('shop.seller.addresses')->first()?->shop?->seller?->addresses?->sortByDesc('is_default')->first() : null;

        return [
            'schedule_id' => $this->schedule->id,
            'reference' => $this->schedule->reference,
            'revision' => $this->schedule->revision,
            'starts_at' => $this->schedule->starts_at->toISOString(),
            'ends_at' => $this->schedule->ends_at->toISOString(),
            'timezone' => 'UTC',
            'order_count' => $this->schedule->orders()->count(),
            'pickup_area' => $address ? ['city_municipality' => $address->city_municipality, 'province' => $address->province, 'region' => $address->region] : null,
            'api_reference' => $notifiable->role === UserRole::Seller
                ? "/api/v1/seller/pickup-requests/{$pickup}/waybills.pdf"
                : "/api/v1/courier/first-mile-tasks?pickup_schedule_id={$this->schedule->id}",
        ];
    }
}
