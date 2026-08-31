<?php

namespace App\Http\Resources\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AccountLifecycleEventResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $name = trim(implode(' ', array_filter([
            $this->actor?->adminProfile?->first_name,
            $this->actor?->adminProfile?->last_name,
        ])));

        return [
            'id' => $this->id,
            'action' => $this->action->value,
            'action_label' => $this->action->label(),
            'previous_status' => $this->previous_status->value,
            'new_status' => $this->new_status->value,
            'reason' => $this->reason,
            'actor' => [
                'id' => $this->acted_by_admin_id,
                'name' => $name !== '' ? $name : ($this->actor?->email ?? 'Former administrator'),
            ],
            'source_feature' => $this->source_feature,
            'source_reference_type' => $this->source_reference_type,
            'source_reference_id' => $this->source_reference_id,
            'occurred_at' => $this->occurred_at?->toIso8601String(),
        ];
    }
}
