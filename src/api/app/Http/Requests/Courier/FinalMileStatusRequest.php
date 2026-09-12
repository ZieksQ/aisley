<?php

namespace App\Http\Requests\Courier;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class FinalMileStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'target_state' => ['required', Rule::in(['in_transit', 'out_for_delivery'])],
            'expected_revision' => ['required', 'integer', 'min:1'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $input = [];
        if (! $this->has('target_state') && $this->has('status')) {
            $input['target_state'] = $this->input('status');
        }
        if (! $this->has('expected_revision') && $this->has('revision')) {
            $input['expected_revision'] = $this->input('revision');
        }
        if ($input !== []) {
            $this->merge($input);
        }
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), ['target_state', 'status', 'expected_revision', 'revision']) as $field) {
                $validator->errors()->add($field, 'This field is not accepted for a final-mile status update.');
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
