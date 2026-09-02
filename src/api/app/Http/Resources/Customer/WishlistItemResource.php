<?php

namespace App\Http\Resources\Customer;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WishlistItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'savedAt' => $this->created_at->toISOString(),
            'product' => [
                ...(new ProductSummaryResource($this->product))->resolve($request),
                'requiresVariantSelection' => $this->product->optionGroups->isNotEmpty(),
            ],
        ];
    }
}
