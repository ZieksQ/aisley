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
        if ($this->has('postal_code')) {
            $postalCode = preg_replace('/[\s-]+/', '', trim((string) $this->input('postal_code')));
            $this->merge(['postal_code' => $postalCode]);
        }
    }

    public function rules(): array
    {
        return [
            'expected_revision' => ['required', 'integer', 'min:1'],
            'lane_id' => ['required', 'uuid'],
            'destination_type' => ['sometimes', 'in:postal_code,hub'],
            'destination_hub_id' => ['required_if:destination_type,hub', 'prohibited_unless:destination_type,hub', 'uuid'],
            'postal_code' => ['required_unless:destination_type,hub', 'nullable', 'prohibited_if:destination_type,hub', 'string', 'regex:/^\d{4}$/'],
            'position' => ['sometimes', 'integer', 'min:1', 'max:999'],
        ];
    }
}
