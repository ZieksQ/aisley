<?php

namespace App\Http\Requests\Logistics;

use Illuminate\Foundation\Http\FormRequest;

class LinehaulReceivingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Active Logistics role, policy consent and tenant scope are enforced by middleware/service.
    }

    public function rules(): array
    {
        if ($this->route()->getActionMethod() === 'batch') {
            return [
                'captures' => ['required', 'array', 'min:1', 'max:100'],
                'captures.*.client_id' => ['required', 'uuid', 'distinct'],
                'captures.*.reference' => ['required', 'string', 'max:255'],
                'captures.*.condition' => ['required', 'in:good,damaged'],
                'captures.*.source' => ['required', 'in:barcode,manual'],
                'captures.*.captured_at' => ['required', 'date'],
                'captures.*.reason' => ['nullable', 'required_if:captures.*.condition,damaged', 'string', 'max:1000'],
            ];
        }

        return [
            'client_id' => ['required', 'uuid'],
            'acknowledge_shortages' => ['sometimes', 'boolean'],
            'reason' => [$this->route()->getActionMethod() === 'resolve' ? 'required' : 'nullable', 'string', 'max:1000'],
        ];
    }
}
