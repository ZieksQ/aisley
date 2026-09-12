<?php

namespace App\Http\Requests\Logistics;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

class OfferDeliveryTaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'courier_id' => ['required', 'uuid'],
            'expected_task_revision' => ['required', 'integer', 'min:1'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if (! $this->has('expected_task_revision') && $this->has('expected_revision')) {
            $this->merge(['expected_task_revision' => $this->input('expected_revision')]);
        }
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), ['courier_id', 'expected_task_revision', 'expected_revision']) as $field) {
                $validator->errors()->add($field, 'This field is not accepted for a task offer.');
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
