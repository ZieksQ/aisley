<?php

namespace App\Http\Requests\Customer;

use Illuminate\Pagination\Cursor;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

class HomepageRecommendationsRequest extends HomepageRequest
{
    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            ...parent::rules(),
            'cursor' => ['sometimes', 'nullable', 'string', 'max:2048'],
        ];
    }

    /**
     * @return list<callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($this->filled('cursor') && ! $this->hasValidCursor()) {
                    $validator->errors()->add('cursor', 'The cursor is invalid.');
                }
            },
        ];
    }

    public function cursor(): ?Cursor
    {
        if (! $this->filled('cursor')) {
            return null;
        }

        return Cursor::fromEncoded((string) $this->input('cursor'));
    }

    private function hasValidCursor(): bool
    {
        $cursor = Cursor::fromEncoded((string) $this->input('cursor'));

        if (! $cursor) {
            return false;
        }

        $parameters = $cursor->toArray();
        $expectedKeys = [
            'products.is_promoted',
            'products.sold_count',
            'products.review_count',
            'products.published_at',
            'products.id',
            '_pointsToNextItems',
        ];

        if (array_keys($parameters) !== $expectedKeys) {
            return false;
        }

        return is_bool($parameters['products.is_promoted'])
            && is_int($parameters['products.sold_count'])
            && is_int($parameters['products.review_count'])
            && is_string($parameters['products.published_at'])
            && strtotime($parameters['products.published_at']) !== false
            && is_string($parameters['products.id'])
            && Str::isUuid($parameters['products.id'])
            && is_bool($parameters['_pointsToNextItems']);
    }
}
