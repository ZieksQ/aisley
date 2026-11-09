<?php

namespace App\Http\Requests\Logistics;

use App\Enums\Logistics\CompanyTruckAvailability;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class FleetMonitoringRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'availability' => ['sometimes', 'nullable', Rule::enum(CompanyTruckAvailability::class)],
            'past' => ['sometimes', 'boolean'],
            'overdue' => ['sometimes', 'boolean'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ];
    }
}
