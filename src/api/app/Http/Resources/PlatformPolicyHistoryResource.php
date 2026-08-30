<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PlatformPolicyHistoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'version' => $this->version,
            'title' => $this->title,
            'status' => $this->status->value,
            'change_summary' => $this->change_summary,
            'published_at' => $this->published_at?->toIso8601String(),
        ];
    }
}
