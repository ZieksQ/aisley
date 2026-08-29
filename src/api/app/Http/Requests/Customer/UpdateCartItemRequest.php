<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateCartItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return [
            'variant_id' => ['sometimes', 'nullable', 'uuid'],
            'quantity' => ['sometimes', 'required', 'integer', 'min:1', 'max:2147483647'],
        ];
    }

    /** @return array<int, callable> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if (! $this->exists('variant_id') && ! $this->exists('quantity')) {
                $validator->errors()->add('quantity', 'Provide a quantity or variant_id to update.');
            }
        }];
    }
}
