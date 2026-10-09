<?php

namespace App\Http\Requests\Messaging;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

class OperationalMessageRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('body')) || $this->input('body') === null) {
            $this->merge(['body' => trim((string) $this->input('body', ''))]);
        }
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['body' => ['required_without:attachment_ids', 'nullable', 'string', 'max:2000'],
            'attachment_ids' => ['sometimes', 'array', 'list', 'max:5'],
            'attachment_ids.*' => ['required', 'uuid', 'distinct']];
    }

    protected function acceptedFields(): array
    {
        return ['body'];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), array_merge($this->acceptedFields(), ['attachment_ids'])) as $field) {
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
