<?php

namespace App\Http\Resources\Seller;

use BackedEnum;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SellerProductQAResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $hasAnswer = is_string($this->answer_text) && $this->answer_text !== '';
        $product = $this->product;
        $status = $product?->status;

        return [
            'id' => $this->id,
            'state' => $hasAnswer ? 'answered' : 'unanswered',
            'question' => $this->question_text,
            'askedAt' => $this->asked_at?->toIso8601String(),
            'answer' => $hasAnswer ? $this->answer_text : null,
            'answeredAt' => $hasAnswer ? $this->answered_at?->toIso8601String() : null,
            'sellerLabel' => $hasAnswer ? ($product?->shop?->name ?: 'Seller') : null,
            'product' => $product === null ? null : [
                'id' => $product->id,
                'name' => $product->name,
                'slug' => $product->slug,
                'status' => $status instanceof BackedEnum ? $status->value : ($status !== null ? (string) $status : null),
                'publishedAt' => $product->published_at?->toIso8601String(),
            ],
        ];
    }
}
