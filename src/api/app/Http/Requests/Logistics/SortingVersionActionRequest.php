<?php

namespace App\Http\Requests\Logistics;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

class SortingVersionActionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $action = $this->route('action');

        return [
            'expected_revision' => ['required', 'integer', 'min:1'],
            'version_id' => [in_array($action, ['activate', 'schedule']) ? 'required' : 'sometimes', 'uuid'],
            'activation_id' => [$action === 'cancel' ? 'required' : 'sometimes', 'uuid'],
            'name' => ['sometimes', 'string', 'min:2', 'max:80'],
            'activate' => ['sometimes', 'boolean'],
            'scheduled_for' => [$action === 'schedule' ? 'required' : 'sometimes', 'date'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if (! Str::isUuid((string) $this->header('Idempotency-Key'))) {
                $validator->errors()->add('idempotency_key', 'A UUID Idempotency-Key is required.');
            }
            if ($this->boolean('activate') && $this->filled('scheduled_for')) {
                $validator->errors()->add('scheduled_for', 'Choose immediate activation or a schedule.');
            }
        }];
    }
}
