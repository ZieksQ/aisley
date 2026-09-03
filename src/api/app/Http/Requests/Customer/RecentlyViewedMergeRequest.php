<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class RecentlyViewedMergeRequest extends FormRequest
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
        $limit = max(1, (int) config('recently-viewed.merge_limit', 12));
        $oldest = now()->subDays(max(1, (int) config('recently-viewed.client_timestamp_max_age_days', 365)))->toISOString();

        return [
            'items' => ['required', 'array', 'min:1', "max:{$limit}"],
            'items.*' => ['required', 'array:productId,viewedAt'],
            'items.*.productId' => ['required', 'uuid', 'distinct'],
            'items.*.viewedAt' => ['sometimes', 'nullable', 'date', 'before_or_equal:now', "after_or_equal:{$oldest}"],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            $unknown = array_diff(array_keys($this->all()), ['items']);
            foreach ($unknown as $key) {
                $validator->errors()->add($key, "The {$key} field is not supported.");
            }
        }];
    }
}
