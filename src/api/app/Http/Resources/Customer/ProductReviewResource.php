<?php

namespace App\Http\Resources\Customer;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductReviewResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'rating' => $this->rating,
            'body' => $this->body,
            'verifiedPurchase' => true,
            'authorLabel' => 'Verified Customer',
            'createdAt' => $this->created_at?->toIso8601String(),
            'photos' => ProductReviewImageResource::collection($this->whenLoaded('images')),
            // Seller responses are a deferred feature; keep the public DTO stable.
            'sellerResponse' => null,
        ];
    }
}
