<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class CreatePolicySuccessorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'change_summary' => ['nullable', 'string', 'max:1000', 'not_regex:/<[^>]+>/'],
        ];
    }
}
