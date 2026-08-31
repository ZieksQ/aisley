<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class StoreSellerComplianceCaseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'seller_id' => ['required', 'uuid'],
            'product_id' => ['nullable', 'uuid'],
            'policy_version_id' => ['nullable', 'uuid'],
            'reason' => ['required', 'string', 'min:3', 'max:2000'],
            'source_type' => ['prohibited'],
            'source_reference_id' => ['prohibited'],
            'status' => ['prohibited'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('reason'))) {
            $this->merge(['reason' => trim($this->input('reason'))]);
        }
    }
}
