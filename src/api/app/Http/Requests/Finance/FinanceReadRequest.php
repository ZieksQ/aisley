<?php

namespace App\Http\Requests\Finance;

use Illuminate\Foundation\Http\FormRequest;

class FinanceReadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Role, approval, consent and Finance permissions are enforced by route middleware.
    }

    public function rules(): array
    {
        return array_merge(DateRangeRules::rules(), [
            'search' => ['nullable', 'string', 'max:120'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'between:1,100'],
        ]);
    }
}
