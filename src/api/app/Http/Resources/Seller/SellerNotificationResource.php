<?php

namespace App\Http\Resources\Seller;

use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SellerNotificationResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $data = is_array($this->data) ? $this->data : [];

        return [
            'id' => $this->id,
            'type' => $this->type,
            'title' => $this->string($data, 'title', $this->fallbackTitle()),
            'summary' => $this->string($data, 'summary', $this->fallbackSummary($data)),
            'read_at' => $this->read_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'destination' => $this->destination($data),
            'schedule' => $this->schedule($data),
        ];
    }

    private function schedule(array $data): ?array
    {
        $scheduleId = $this->value($data, 'schedule_id');
        if ($scheduleId === null) {
            return null;
        }

        return [
            'id' => $scheduleId,
            'reference' => $this->value($data, 'reference'),
            'starts_at' => $this->value($data, 'starts_at'),
            'ends_at' => $this->value($data, 'ends_at'),
            'timezone' => $this->value($data, 'timezone') ?? 'Asia/Manila',
            'order_count' => is_int($data['order_count'] ?? null) ? $data['order_count'] : null,
            'pickup_area' => is_array($data['pickup_area'] ?? null) ? [
                'city_municipality' => $this->value($data['pickup_area'], 'city_municipality'),
                'province' => $this->value($data['pickup_area'], 'province'),
                'region' => $this->value($data['pickup_area'], 'region'),
            ] : null,
        ];
    }

    private function destination(array $data): string
    {
        $destination = $this->value($data, 'destination');
        foreach (['/orders/', '/orders', '/products/', '/account', '/inventory/', '/low-stock-alerts/'] as $allowed) {
            if ($destination !== null && str_starts_with($destination, $allowed)) {
                return $destination;
            }
        }

        return '/notifications/'.$this->id;
    }

    private function fallbackTitle(): string
    {
        return match ($this->type) {
            'pickup-schedule.assigned' => 'Pickup scheduled',
            'pickup-schedule.revised' => 'Pickup schedule updated',
            'pickup-schedule.cancelled' => 'Pickup schedule cancelled',
            'pickup-schedule.reminder' => 'Pickup starts in one hour',
            default => 'Notification',
        };
    }

    private function fallbackSummary(array $data): string
    {
        if (! str_starts_with((string) $this->type, 'pickup-schedule.')) {
            return 'An update is available.';
        }

        $reference = $this->value($data, 'reference') ?? 'your pickup';
        $orderCount = is_numeric($data['order_count'] ?? null) ? (int) $data['order_count'] : null;
        $orders = $orderCount === null ? '' : sprintf(' for %d %s', $orderCount, $orderCount === 1 ? 'Order' : 'Orders');
        $window = 'the scheduled pickup window';
        $startsAtValue = $this->value($data, 'starts_at');
        $endsAtValue = $this->value($data, 'ends_at');
        if ($startsAtValue !== null && $endsAtValue !== null) {
            try {
                $startsAt = CarbonImmutable::parse($startsAtValue)->timezone('Asia/Manila');
                $endsAt = CarbonImmutable::parse($endsAtValue)->timezone('Asia/Manila');
                $window = $startsAt->format('M j, Y g:i A').'–'.$endsAt->format('g:i A').' PHT';
            } catch (\Throwable) {
                // Keep the truthful unavailable-window fallback for malformed legacy data.
            }
        }

        return match ($this->type) {
            'pickup-schedule.assigned' => "Pickup schedule {$reference} is set for {$window}{$orders}.",
            'pickup-schedule.revised' => "Pickup schedule {$reference} was moved to {$window}{$orders}.",
            'pickup-schedule.cancelled' => "Pickup schedule {$reference}{$orders}, scheduled for {$window}, was cancelled.",
            'pickup-schedule.reminder' => "Pickup schedule {$reference}{$orders} is scheduled for {$window}.",
            default => "Pickup schedule {$reference} has an update.",
        };
    }

    private function string(array $data, string $key, string $fallback): string
    {
        return $this->value($data, $key, 500) ?? $fallback;
    }

    private function value(array $data, string $key, int $limit = 160): ?string
    {
        $value = $data[$key] ?? null;

        return is_string($value) && $value !== '' ? mb_substr($value, 0, $limit) : null;
    }
}
