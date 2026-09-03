<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Pagination\Cursor;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

class RecentlyViewedListRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'cursor' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'limit' => [
                'sometimes',
                'integer',
                'min:1',
                'max:'.max(1, (int) config('recently-viewed.max_page_size', 50)),
            ],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            $unknown = array_diff(array_keys($this->query()), ['cursor', 'limit']);
            foreach ($unknown as $key) {
                $validator->errors()->add($key, "The {$key} parameter is not supported.");
            }

            if ($this->filled('cursor') && ! $this->hasValidCursor()) {
                $validator->errors()->add('cursor', 'The cursor is invalid.');
            }
        }];
    }

    public function cursor(): ?Cursor
    {
        return $this->filled('cursor')
            ? Cursor::fromEncoded((string) $this->input('cursor'))
            : null;
    }

    public function pageSize(): int
    {
        return (int) $this->validated(
            'limit',
            max(1, (int) config('recently-viewed.default_page_size', 20)),
        );
    }

    private function hasValidCursor(): bool
    {
        $cursor = Cursor::fromEncoded((string) $this->input('cursor'));
        if (! $cursor) {
            return false;
        }

        $parameters = $cursor->toArray();
        $keys = array_keys($parameters);

        if ($keys !== ['recently_viewed_products.last_viewed_at', 'recently_viewed_products.id', '_pointsToNextItems']) {
            return false;
        }

        return is_string($parameters['recently_viewed_products.last_viewed_at'])
            && strtotime($parameters['recently_viewed_products.last_viewed_at']) !== false
            && is_string($parameters['recently_viewed_products.id'])
            && Str::isUuid($parameters['recently_viewed_products.id'])
            && is_bool($parameters['_pointsToNextItems']);
    }
}
