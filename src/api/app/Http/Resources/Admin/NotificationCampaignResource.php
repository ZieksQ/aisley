<?php

namespace App\Http\Resources\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NotificationCampaignResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'body' => $this->body,
            'audience_key' => $this->audience_key,
            'audience_label' => 'Customers opted in to in-app promotions',
            'destination_type' => $this->destination_type,
            'destination_id' => $this->destination_id,
            'status' => $this->status->value,
            'revision' => $this->revision,
            'preview' => $this->previewed_at ? [
                'eligible_count' => $this->preview_eligible_count,
                'calculated_at' => $this->previewed_at->toIso8601String(),
                'revision' => $this->preview_revision,
            ] : null,
            'snapshot_count' => $this->snapshot_count,
            'delivered_count' => $this->delivered_count,
            'skipped_count' => $this->skipped_count,
            'failed_count' => $this->failed_count,
            'confirmed_at' => $this->confirmed_at?->toIso8601String(),
            'completed_at' => $this->completed_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
