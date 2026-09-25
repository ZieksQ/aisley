<?php

namespace App\Http\Requests\Support;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

abstract class SupportTicketMutationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    abstract protected function acceptedFields(): array;

    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), $this->acceptedFields()) as $field) {
                $validator->errors()->add($field, 'This field is not accepted.');
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
