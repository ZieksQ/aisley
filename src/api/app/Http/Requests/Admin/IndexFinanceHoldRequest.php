<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Finance\DateRangeRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IndexFinanceHoldRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [...DateRangeRules::rules(),
            'status' => ['sometimes', Rule::in(['open', 'resolved'])],
            'search' => ['sometimes', 'string', 'max:120'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ];
    }
}
