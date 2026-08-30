<?php

namespace App\Http\Resources\Customer;

use App\Services\Customer\CustomerOrderStatusMapper;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderTrackingResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $metadata = is_array($this->public_metadata) ? $this->public_metadata : [];
        $statuses = app(CustomerOrderStatusMapper::class);

        return [
            'id' => $this->id,
            'status' => $this->to_status->value,
            'label' => $this->safeString($metadata, 'label') ?? $statuses->statusLabel($this->to_status),
            'eventType' => $this->safeString($metadata, 'event_type'),
            'location' => array_filter([
                'hub' => $this->safeString($metadata, 'hub_label'),
                'city' => $this->safeString($metadata, 'city_label'),
            ], fn ($value) => $value !== null),
            'occurredAt' => $this->occurred_at->toISOString(),
        ];
    }

    /** @param array<string, mixed> $metadata */
    private function safeString(array $metadata, string $key): ?string
    {
        $value = $metadata[$key] ?? null;

        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }
}
