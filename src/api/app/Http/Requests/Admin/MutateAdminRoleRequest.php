<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class MutateAdminRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100'],
            'permissions' => ['present', 'array', 'max:100'],
            'permissions.*' => ['string', 'distinct', 'exists:permissions,slug'],
            'current_password' => ['required', 'string', 'current_password:web'],
            'revision' => $this->isMethod('post') ? ['prohibited'] : ['required', 'integer', 'min:0'],
        ];
    }
}
