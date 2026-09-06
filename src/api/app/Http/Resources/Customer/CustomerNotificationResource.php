<?php

namespace App\Http\Resources\Customer;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CustomerNotificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $data = is_array($this->data) ? $this->data : [];
        $orderId = $this->value($data, 'order_id');

        return [
            'id' => $this->id,
            'type' => $this->type,
            'title' => $this->string($data, 'title', 'Notification'),
            'summary' => $this->string($data, 'summary', 'An update is available.'),
            'order_id' => $orderId,
            'order_reference' => $this->value($data, 'order_reference'),
            'status' => $this->value($data, 'status'),
            'read_at' => $this->read_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'destination' => $orderId ? "/orders/{$orderId}" : "/notifications/{$this->id}",
        ];
    }

    private function string(array $data, string $key, string $fallback): string
    {
        $value = $data[$key] ?? null;

        return is_string($value) && $value !== '' ? mb_substr($value, 0, 500) : $fallback;
    }

    private function value(array $data, string $key): ?string
    {
        $value = $data[$key] ?? null;

        return is_string($value) && $value !== '' ? mb_substr($value, 0, 160) : null;
    }
}
