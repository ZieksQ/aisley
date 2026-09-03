<?php

namespace App\Http\Resources\Customer;

use App\Support\MediaUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ShopSummaryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'description' => $this->description,
            'logoUrl' => MediaUrl::from('public', $this->logo_path),
            'bannerUrl' => MediaUrl::from('public', $this->banner_path),
            'category' => $this->whenLoaded(
                'shopCategory',
                fn () => $this->shopCategory === null
                    ? null
                    : new ShopCategorySummaryResource($this->shopCategory),
            ),
        ];
    }
}
