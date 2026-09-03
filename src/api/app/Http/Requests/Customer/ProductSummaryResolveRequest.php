<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ProductSummaryResolveRequest extends FormRequest
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
            'productIds' => [
                'required',
                'array',
                'min:1',
                'max:'.max(1, (int) config('recently-viewed.resolver_limit', 12)),
            ],
            'productIds.*' => ['required', 'uuid', 'distinct'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            $unknown = array_diff(array_keys($this->all()), ['productIds']);
            foreach ($unknown as $key) {
                $validator->errors()->add($key, "The {$key} field is not supported.");
            }
        }];
    }
}
