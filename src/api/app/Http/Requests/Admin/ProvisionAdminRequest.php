<?php

namespace App\Http\Requests\Admin;

use App\Support\Admin\PasswordPolicy;
use Illuminate\Foundation\Http\FormRequest;

class ProvisionAdminRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['email' => mb_strtolower(trim((string) $this->input('email')))]);
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'email', 'max:255'],
            'first_name' => ['required', 'string', 'max:255'],
            'middle_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'contact_number' => ['nullable', 'string', 'max:32'],
            'permissions' => ['present', 'array', 'max:100'],
            'permissions.*' => ['string', 'distinct', 'exists:permissions,slug'],
            'role_ids' => ['present', 'array', 'max:100'],
            'role_ids.*' => ['uuid', 'distinct', 'exists:admin_roles,id'],
            'is_super_admin' => ['sometimes', 'boolean'],
            'current_password' => ['required', 'string', 'current_password:web'],
            'password' => $this->isMethod('post') ? ['required', 'string', 'confirmed', PasswordPolicy::rule()] : ['prohibited'],
            'revision' => $this->isMethod('post') ? ['prohibited'] : ['required', 'integer', 'min:0'],
        ];
    }
}
