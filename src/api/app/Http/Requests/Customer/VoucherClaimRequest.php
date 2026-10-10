<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class VoucherClaimRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [];
    }

    public function after(): array
    {
        return [function (Validator $validator) {
            foreach (array_keys($this->all()) as $key) {
                $validator->errors()->add($key, 'Collection accepts no Customer, ownership or term fields.');
            }
        }];
    }
}
