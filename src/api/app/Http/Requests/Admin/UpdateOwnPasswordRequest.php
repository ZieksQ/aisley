<?php

namespace App\Http\Requests\Admin;

use App\Support\Admin\PasswordPolicy;
use Illuminate\Foundation\Http\FormRequest;

class UpdateOwnPasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'current_password' => ['required', 'string', 'current_password:web'],
            'password' => ['required', 'string', 'confirmed', PasswordPolicy::rule()],
        ];
    }
}
