<?php

namespace App\Http\Requests\Courier;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

class CompleteDeliveryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'expected_revision' => ['required', 'integer', 'min:1'],
            'evidence_id' => ['required', 'uuid'],
            'confirmed' => ['required', 'boolean', 'accepted'],
            'cod_collected' => ['sometimes', 'boolean', 'accepted'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), ['expected_revision', 'evidence_id', 'confirmed', 'cod_collected']) as $field) {
                $validator->errors()->add($field, 'This field is not accepted for completion.');
            }
            if (! Str::isUuid((string) $this->header('Idempotency-Key'))) {
                $validator->errors()->add('idempotency_key', 'A UUID Idempotency-Key header is required.');
            }
        }];
    }

    public function messages(): array
    {
        return ['cod_collected.accepted' => 'Confirm the exact COD amount was collected, or record an unsuccessful delivery attempt.'];
    }

    public function idempotencyKey(): string
    {
        return (string) $this->header('Idempotency-Key');
    }
}
