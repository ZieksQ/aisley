<?php

namespace App\Http\Resources\Seller;

use BackedEnum;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SellerProductReviewResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $product = $this->product;
        $response = $this->sellerResponse;
        $status = $product?->status;

        return [
            'id' => $this->id,
            'rating' => $this->rating,
            'body' => $this->body,
            'verifiedPurchase' => true,
            'authorLabel' => 'Verified Customer',
            'createdAt' => $this->created_at?->toIso8601String(),
            'responseState' => $response === null ? 'unanswered' : 'answered',
            'sellerResponse' => $response === null ? null : [
                'id' => $response->id,
                'shopName' => $response->shop_name_snapshot,
                'body' => $response->body,
                'status' => $response->status instanceof BackedEnum ? $response->status->value : (string) $response->status,
                'publishedAt' => $response->published_at?->toIso8601String(),
            ],
            'product' => [
                'id' => $this->product_id,
                'name' => $this->product_name_snapshot,
                'currentName' => $product?->name,
                'status' => $status instanceof BackedEnum ? $status->value : ($status !== null ? (string) $status : null),
                'isDeleted' => $product?->trashed() ?? false,
            ],
            'variant' => $this->product_variant_id === null && $this->variant_name_snapshot === null ? null : [
                'id' => $this->product_variant_id,
                'name' => $this->variant_name_snapshot,
            ],
            'photos' => $this->images->map(fn ($image): array => [
                'id' => $image->id,
                'url' => "/api/v1/seller/reviews/{$this->id}/images/{$image->id}",
                'mimeType' => $image->mime_type,
                'width' => $image->width,
                'height' => $image->height,
            ])->values(),
        ];
    }
}
