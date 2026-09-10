<?php

namespace App\Http\Resources\Customer;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductQAResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $hasAnswer = is_string($this->answer_text) && $this->answer_text !== '';

        return [
            'id' => $this->id,
            'question' => $this->question_text,
            'askedAt' => $this->asked_at?->toIso8601String(),
            'answer' => $hasAnswer ? $this->answer_text : null,
            'answeredAt' => $hasAnswer ? $this->answered_at?->toIso8601String() : null,
            'sellerLabel' => $hasAnswer ? ($this->product?->shop?->name ?: 'Seller') : null,
        ];
    }
}
