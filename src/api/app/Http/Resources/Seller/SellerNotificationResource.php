<?php

namespace App\Http\Resources\Seller;

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
            'title' => $this->string($data, 'title', 'Notification'),
            'summary' => $this->string($data, 'summary', 'An update is available.'),
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
