<?php

namespace App\Http\Resources\Admin;

use App\Support\MediaUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class HomepageAdvertisementConfigurationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return ['id' => $this->id, 'source_configuration_id' => $this->source_configuration_id, 'layout' => $this->layout->value, 'rotation_interval_seconds' => $this->rotation_interval_seconds, 'status' => $this->status->value, 'revision' => $this->revision, 'published_at' => $this->published_at?->toIso8601String(), 'created_at' => $this->created_at?->toIso8601String(), 'ads' => $this->whenLoaded('campaigns', fn () => $this->campaigns->map(fn ($ad) => ['id' => $ad->id, 'slot' => $ad->slot, 'position' => $ad->position, 'title' => $ad->title, 'description' => $ad->description, 'image_desktop_path' => MediaUrl::from($ad->image_disk, $ad->image_desktop_path), 'image_mobile_path' => MediaUrl::from($ad->image_disk, $ad->image_mobile_path), 'alt_text' => $ad->alt_text, 'destination_url' => $ad->destination_url, 'starts_at' => $ad->starts_at?->toIso8601String(), 'ends_at' => $ad->ends_at?->toIso8601String(), 'is_active' => $ad->is_active])->values())];
    }
}
