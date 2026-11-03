<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PolicyAcceptanceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $version = $this->resource['version'];

        return [
            'type' => $this->resource['policy']->type->value,
            'label' => $this->resource['policy']->type->label(),
            'version' => [
                'id' => $version->id,
                'version' => $version->version,
                'title' => $version->title,
                'content' => $version->content,
                'status' => $version->status->value,
                'change_summary' => $version->change_summary,
                'requires_reconsent' => $version->requires_reconsent,
                'published_at' => $version->published_at?->toIso8601String(),
            ],
            'accepted_at' => $this->resource['acceptance']->accepted_at?->toIso8601String(),
        ];
    }
}
