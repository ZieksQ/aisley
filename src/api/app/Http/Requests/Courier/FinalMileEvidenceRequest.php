<?php

namespace App\Http\Requests\Courier;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class FinalMileEvidenceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'identifier_type' => ['required', Rule::in(['qr', 'order_id'])],
            'identifier' => ['required', 'string', 'max:128'],
            'expected_revision' => ['required', 'integer', 'min:1'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), ['identifier_type', 'identifier', 'expected_revision']) as $field) {
                $validator->errors()->add($field, 'This field is not accepted for final-mile evidence.');
            }
            if (! Str::isUuid((string) $this->header('Idempotency-Key'))) {
                $validator->errors()->add('idempotency_key', 'A UUID Idempotency-Key header is required.');
            }
        }];
    }

    public function idempotencyKey(): string
    {
        return (string) $this->header('Idempotency-Key');
    }
}
