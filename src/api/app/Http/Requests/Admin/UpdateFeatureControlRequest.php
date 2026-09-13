<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateFeatureControlRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'enabled' => ['required', 'boolean'],
            'revision' => ['required', 'integer', 'min:1'],
        ];
    }
}
