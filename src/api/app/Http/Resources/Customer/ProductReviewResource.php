<?php

namespace App\Http\Resources\Customer;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductReviewResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $response = $this->relationLoaded('sellerResponse') ? $this->sellerResponse : null;

        return [
            'id' => $this->id,
            'rating' => $this->rating,
            'body' => $this->body,
            'verifiedPurchase' => true,
            'authorLabel' => 'Verified Customer',
            'createdAt' => $this->created_at?->toIso8601String(),
            'photos' => ProductReviewImageResource::collection($this->whenLoaded('images')),
            'sellerResponse' => $response === null
                || $response->status->value !== 'published'
                || $response->published_at === null
                || $response->published_at->isFuture()
                ? null
                : [
                    'id' => $response->id,
                    'shopName' => $response->shop_name_snapshot,
                    'body' => $response->body,
                    'publishedAt' => $response->published_at?->toIso8601String(),
                ],
        ];
    }
}
