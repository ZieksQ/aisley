<?php

namespace App\Http\Resources\Customer;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductReviewImageResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'url' => url('/api/v1/product-review-images/'.$this->id),
            'mimeType' => $this->mime_type,
            'width' => $this->width,
            'height' => $this->height,
        ];
    }
}
