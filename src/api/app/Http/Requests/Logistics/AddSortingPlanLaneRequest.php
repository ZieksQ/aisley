<?php

namespace App\Http\Requests\Logistics;

use Illuminate\Foundation\Http\FormRequest;

class AddSortingPlanLaneRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $postalCode = preg_replace('/[\s-]+/', '', trim((string) $this->input('postal_code')));
        $this->merge(['postal_code' => $postalCode]);
    }

    public function rules(): array
    {
        return [
            'expected_revision' => ['required', 'integer', 'min:1'],
            'lane_id' => ['required', 'uuid'],
            'postal_code' => ['required', 'string', 'regex:/^\d{4}$/'],
            'position' => ['sometimes', 'integer', 'min:1', 'max:999'],
        ];
    }
}
