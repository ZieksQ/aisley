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
        $scheduleOrders = $this->schedule->orders()->with('order.waybill.snapshot')->get();
        $sellerShopId = $notifiable->role === UserRole::Seller ? $notifiable->shop?->id : null;
        $visibleOrders = $sellerShopId
            ? $scheduleOrders->filter(fn ($scheduleOrder) => $scheduleOrder->order?->shop_id === $sellerShopId)
            : $scheduleOrders;
        $firstOrder = $visibleOrders->first();
        $pickupIds = $visibleOrders->pluck('seller_pickup_request_id')->unique()->values();
        $pickup = $pickupIds->count() === 1 ? $pickupIds->first() : null;
        $address = $firstOrder?->order?->waybill?->snapshot?->payload['pickup'] ?? null;
        $startsAt = Carbon::parse($this->schedule->starts_at)->timezone('Asia/Manila');
        $endsAt = Carbon::parse($this->schedule->ends_at)->timezone('Asia/Manila');
        $orderCount = $visibleOrders->count();
        $pickupStopCount = $visibleOrders
            ->map(fn ($scheduleOrder) => $scheduleOrder->order?->waybill?->snapshot?->payload['pickup'] ?? null)
            ->filter()
            ->unique(fn (array $pickupAddress) => implode('|', [
                $pickupAddress['address_line_1'] ?? '',
                $pickupAddress['barangay'] ?? '',
                $pickupAddress['city_municipality'] ?? '',
                $pickupAddress['province'] ?? '',
                $pickupAddress['latitude'] ?? '',
                $pickupAddress['longitude'] ?? '',
            ]))
            ->count();
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
            'pickup_stop_count' => $pickupStopCount,
            'pickup_area' => $address && $pickupStopCount === 1 ? ['city_municipality' => $address['city_municipality'], 'province' => $address['province'], 'region' => $address['region']] : null,
            'api_reference' => $notifiable->role === UserRole::Seller
                ? ($pickup ? "/api/v1/seller/pickup-requests/{$pickup}/waybills.pdf" : '/api/v1/seller/orders?status=ready_for_pickup')
                : "/api/v1/courier/first-mile-tasks?pickup_schedule_id={$this->schedule->id}",
            'resource_type' => 'pickup_schedule',
            'resource_id' => $this->schedule->id,
            'destination' => $notifiable->role === UserRole::Seller ? '/orders/pickup' : null,
        ];
    }
}
