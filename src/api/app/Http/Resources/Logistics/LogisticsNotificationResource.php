<?php

namespace App\Http\Resources\Logistics;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The controller gives this resource an already-authorized projection. This
 * keeps legacy notification data out of the response and prevents a resource
 * payload from becoming an arbitrary destination or tenant selector.
 */
class LogisticsNotificationResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        if (is_array($this->resource)) {
            return $this->resource;
        }

        return [
            'id' => $this->id,
            'type' => $this->type,
            'title' => 'Notification',
            'summary' => 'An update is available.',
            'read_at' => $this->read_at?->utc()->toIso8601String(),
            'created_at' => $this->created_at?->utc()->toIso8601String(),
            'resource_type' => null,
            'resource_id' => null,
            'destination' => null,
        ];
    }
}
