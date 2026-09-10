<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

class CancelOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'reason' => ['sometimes', 'nullable', 'string', 'max:500'],
        ];
    }

    /** @return list<callable> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), ['reason']) as $field) {
                $validator->errors()->add($field, 'This field is not accepted for order cancellation.');
            }

            $key = $this->header('Idempotency-Key');
            if (! is_string($key) || ! Str::isUuid($key)) {
                $validator->errors()->add('idempotency_key', 'A UUID Idempotency-Key header is required.');
            }
        }];
    }

    public function idempotencyKey(): string
    {
        return (string) $this->header('Idempotency-Key');
    }
}
