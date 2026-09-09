<?php

namespace App\Notifications;

use App\Enums\UserRole;
use App\Models\PickupSchedule;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Carbon;

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
        $firstOrder = $this->schedule->orders()->with('order.waybill.snapshot')->first();
        $pickup = $firstOrder?->seller_pickup_request_id;
        $address = $firstOrder?->order?->waybill?->snapshot?->payload['pickup'] ?? null;
        $startsAt = Carbon::parse($this->schedule->starts_at)->timezone('Asia/Manila');
        $endsAt = Carbon::parse($this->schedule->ends_at)->timezone('Asia/Manila');
        $orderCount = $this->schedule->orders()->count();
        $window = sprintf('%s–%s PHT', $startsAt->format('M j, Y g:i A'), $endsAt->format('g:i A'));
        $labels = [
            'assigned' => ['Pickup scheduled', "Pickup schedule {$this->schedule->reference} is set for {$window}"],
            'revised' => ['Pickup schedule updated', "Pickup schedule {$this->schedule->reference} was moved to {$window}"],
            'cancelled' => ['Pickup schedule cancelled', "Pickup schedule {$this->schedule->reference} for {$window} was cancelled"],
            'reminder' => ['Pickup starts in one hour', "Pickup schedule {$this->schedule->reference} starts at {$startsAt->format('g:i A')} PHT"],
        ];
        [$title, $summaryPrefix] = $labels[$this->event] ?? ['Pickup schedule update', "Pickup schedule {$this->schedule->reference} is set for {$window}"];

        return [
            'title' => $title,
            'summary' => sprintf('%s for %d %s.', $summaryPrefix, $orderCount, $orderCount === 1 ? 'Order' : 'Orders'),
            'schedule_id' => $this->schedule->id,
            'reference' => $this->schedule->reference,
            'revision' => $this->schedule->revision,
            'starts_at' => $this->schedule->starts_at->toISOString(),
            'ends_at' => $this->schedule->ends_at->toISOString(),
            'timezone' => 'Asia/Manila',
            'order_count' => $orderCount,
            'pickup_area' => $address ? ['city_municipality' => $address['city_municipality'], 'province' => $address['province'], 'region' => $address['region']] : null,
            'api_reference' => $notifiable->role === UserRole::Seller
                ? "/api/v1/seller/pickup-requests/{$pickup}/waybills.pdf"
                : "/api/v1/courier/first-mile-tasks?pickup_schedule_id={$this->schedule->id}",
            'resource_type' => 'pickup_schedule',
            'resource_id' => $this->schedule->id,
            'destination' => $notifiable->role === UserRole::Seller ? '/orders/pickup' : null,
        ];
    }
}
