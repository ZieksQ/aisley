<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class VoucherStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['ids' => ['required', 'array', 'min:1', 'max:50'], 'ids.*' => ['required', 'uuid', 'distinct']];
    }

    public function after(): array
    {
        return [function (Validator $validator) {
            foreach (array_diff(array_keys($this->query()), ['ids']) as $key) {
                $validator->errors()->add($key, 'This parameter is not supported.');
            }
        }];
    }
}
