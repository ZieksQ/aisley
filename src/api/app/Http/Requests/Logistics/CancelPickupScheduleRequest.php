<?php

namespace App\Http\Requests\Logistics;

use Illuminate\Foundation\Http\FormRequest;

class CancelPickupScheduleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['expected_revision' => ['required', 'integer', 'min:1'], 'reason' => ['required', 'string', 'max:1000']];
    }
}
