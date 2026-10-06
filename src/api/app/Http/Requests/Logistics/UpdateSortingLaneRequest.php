<?php

namespace App\Http\Requests\Logistics;

use App\Enums\Logistics\SortingLaneState;
use App\Enums\Logistics\SortingLaneType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateSortingLaneRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($this->has('operational_state') && ! Str::isUuid((string) $this->header('Idempotency-Key'))) {
                $validator->errors()->add('idempotency_key', 'A UUID Idempotency-Key is required for lane controls.');
            }
        }];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('code')) {
            $this->merge(['code' => mb_strtoupper(trim((string) $this->input('code')))]);
        }
    }

    public function rules(): array
    {
        return [
            'expected_revision' => ['required', 'integer', 'min:1'],
            'code' => ['sometimes', 'string', 'min:2', 'max:24', 'regex:/^[A-Z0-9][A-Z0-9_-]+$/'],
            'name' => ['sometimes', 'string', 'min:2', 'max:80'],
            'type' => ['sometimes', Rule::enum(SortingLaneType::class)],
            'position' => ['sometimes', 'integer', 'min:1', 'max:999'],
            'operational_state' => ['sometimes', Rule::enum(SortingLaneState::class)],
            'blocking_reason' => ['nullable', 'string', 'min:3', 'max:1000'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
