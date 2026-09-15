<?php

namespace App\Http\Requests\Logistics;

use App\Enums\Logistics\SortingLaneType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CreateSortingLaneRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['code' => mb_strtoupper(trim((string) $this->input('code')))]);
    }

    public function rules(): array
    {
        return [
            'code' => ['required', 'string', 'min:2', 'max:24', 'regex:/^[A-Z0-9][A-Z0-9_-]+$/'],
            'name' => ['required', 'string', 'min:2', 'max:80'],
            'type' => ['required', Rule::enum(SortingLaneType::class)],
            'position' => ['sometimes', 'integer', 'min:1', 'max:999'],
        ];
    }
}
