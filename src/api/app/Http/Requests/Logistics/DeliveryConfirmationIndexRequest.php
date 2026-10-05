<?php

namespace App\Http\Requests\Logistics;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DeliveryConfirmationIndexRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['search' => ['sometimes', 'string', 'max:120'], 'view' => ['sometimes', Rule::in(['pending', 'history'])],
            'per_page' => ['sometimes', 'integer', 'between:1,50'], 'page' => ['sometimes', 'integer', 'min:1']];
    }
}
