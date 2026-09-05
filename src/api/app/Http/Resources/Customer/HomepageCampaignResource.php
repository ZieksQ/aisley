<?php

namespace App\Http\Resources\Customer;

use App\Support\MediaUrl;
use App\Support\SafeHomepageDestination;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class HomepageCampaignResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'placement' => $this->placement->value,
            'title' => $this->title,
            'description' => $this->description,
            'slot' => $this->slot,
            'position' => $this->position,
            'imageDesktopUrl' => $this->imageUrl('desktop'),
            'imageMobileUrl' => $this->imageUrl('mobile'),
            'altText' => $this->alt_text,
            'destinationUrl' => SafeHomepageDestination::sanitize($this->destination_url),
            'startsAt' => $this->starts_at?->toISOString(),
            'endsAt' => $this->ends_at?->toISOString(),
            'priority' => $this->priority,
            'isActive' => true,
        ];
    }

    private function imageUrl(string $variant): ?string
    {
        $path = $variant === 'desktop' ? $this->image_desktop_path : $this->image_mobile_path;
        if (! $path) {
            return null;
        }

        if ($this->homepage_advertisement_configuration_id !== null) {
            return url("/api/v1/homepage-advertisement-images/{$this->id}/{$variant}");
        }

        return MediaUrl::from($this->image_disk, $path);
    }
}
