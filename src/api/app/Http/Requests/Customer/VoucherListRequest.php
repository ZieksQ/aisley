<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class VoucherListRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'issuer' => ['sometimes', Rule::in(['app', 'shop'])],
            'benefit' => ['sometimes', Rule::in(['discount', 'shipping'])],
            'page' => ['sometimes', 'integer', 'min:1', 'max:10000'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:50'],
            ...($this->routeIs('customer.vouchers.mine') ? ['status' => ['sometimes', Rule::in(['available', 'upcoming', 'history'])]] : []),
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator) {
            foreach (array_diff(array_keys($this->query()), array_keys($this->rules())) as $key) {
                $validator->errors()->add($key, 'This filter is not supported.');
            }
        }];
    }
}
