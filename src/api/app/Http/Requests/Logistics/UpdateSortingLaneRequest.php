<?php

namespace App\Http\Requests\Logistics;

use App\Enums\Logistics\SortingLaneType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSortingLaneRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
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
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
