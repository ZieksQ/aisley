<?php

namespace App\Http\Requests\Logistics;

use Illuminate\Foundation\Http\FormRequest;

class CloseSortingSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['carry_over_exceptions' => ['sometimes', 'boolean'], 'expected_revision' => ['required', 'integer', 'min:1']];
    }
}
