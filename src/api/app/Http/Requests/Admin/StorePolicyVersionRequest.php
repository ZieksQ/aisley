<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class StorePolicyVersionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:200'],
            'content' => ['required', 'string', 'max:100000', 'not_regex:/<[^>]+>/'],
            'requires_reconsent' => ['required', 'boolean'],
            'status' => ['prohibited'],
            'version' => ['prohibited'],
        ];
    }
}
