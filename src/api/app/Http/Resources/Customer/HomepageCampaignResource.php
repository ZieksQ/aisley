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
            'imageDesktopUrl' => MediaUrl::from($this->image_disk, $this->image_desktop_path),
            'imageMobileUrl' => MediaUrl::from($this->image_disk, $this->image_mobile_path),
            'altText' => $this->alt_text,
            'destinationUrl' => SafeHomepageDestination::sanitize($this->destination_url),
            'startsAt' => $this->starts_at->toISOString(),
            'endsAt' => $this->ends_at->toISOString(),
            'priority' => $this->priority,
            'isActive' => true,
        ];
    }
}
