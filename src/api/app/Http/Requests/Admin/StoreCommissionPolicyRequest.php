<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCommissionPolicyRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Role and Finance permission are enforced by the route middleware.
        return true;
    }

    public function rules(): array
    {
        return [
            'beneficiary_type' => ['required', Rule::in(['seller', 'logistics'])],
            'rate_basis_points' => ['required', 'integer', 'between:0,10000'],
            'effective_at' => ['sometimes', 'nullable', 'date'],
        ];
    }
}
