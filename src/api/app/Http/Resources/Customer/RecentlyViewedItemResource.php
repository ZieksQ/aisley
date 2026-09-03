<?php

namespace App\Http\Resources\Customer;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RecentlyViewedItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'lastViewedAt' => $this->last_viewed_at->toISOString(),
            'product' => (new ProductSummaryResource($this->product))->resolve($request),
        ];
    }
}
