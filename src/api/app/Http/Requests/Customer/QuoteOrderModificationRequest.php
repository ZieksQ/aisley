<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class QuoteOrderModificationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['address_id' => ['required', 'uuid'], 'expected_revision' => ['required', 'integer', 'min:1']];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), ['address_id', 'expected_revision']) as $field) {
                $validator->errors()->add($field, 'This field is not accepted for address quotations.');
            }
        }];
    }
}
