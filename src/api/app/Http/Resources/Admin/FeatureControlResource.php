<?php

namespace App\Http\Resources\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FeatureControlResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'key' => $this->key,
            'label' => $this->label,
            'description' => $this->description,
            'enabled' => $this->enabled,
            'revision' => $this->revision,
            'updated_at' => $this->updated_at?->toIso8601String(),
            'updated_by' => $this->whenLoaded('updatedByAdmin', fn () => [
                'id' => $this->updatedByAdmin->id,
                'email' => $this->updatedByAdmin->email,
            ]),
        ];
    }
}
