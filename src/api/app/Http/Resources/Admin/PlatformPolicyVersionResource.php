<?php

namespace App\Http\Resources\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PlatformPolicyVersionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'version' => $this->version,
            'title' => $this->title,
            'content' => $this->content,
            'status' => $this->status->value,
            'requires_reconsent' => $this->requires_reconsent,
            'revision' => $this->revision,
            'published_at' => $this->published_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'created_by' => $this->whenLoaded('creator', fn () => ['id' => $this->creator->id, 'email' => $this->creator->email]),
        ];
    }
}
