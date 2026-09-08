<?php

namespace App\Http\Requests\Logistics;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListPickupsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['status' => ['sometimes', Rule::in(['pending_logistics', 'partially_scheduled', 'scheduled'])], 'date_from' => ['sometimes', 'date'], 'date_to' => ['sometimes', 'date', 'after_or_equal:date_from'], 'search' => ['sometimes', 'string', 'max:100'], 'per_page' => ['sometimes', 'integer', 'min:1', 'max:50']];
    }
}
