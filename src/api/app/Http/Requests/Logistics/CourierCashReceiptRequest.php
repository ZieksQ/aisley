<?php

namespace App\Http\Requests\Logistics;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class CourierCashReceiptRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['obligation_ids' => ['required', 'array', 'min:1', 'max:500'],
            'obligation_ids.*' => ['required', 'uuid', 'distinct'],
            'confirmed' => ['required', 'accepted'], 'idempotency_key' => ['required', 'uuid']];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), ['obligation_ids', 'confirmed', 'idempotency_key']) as $field) {
                $validator->errors()->add($field, 'This field is not accepted for cash reception.');
            }
        }];
    }
}
