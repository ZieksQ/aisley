<?php

namespace App\Http\Requests\Admin;

use App\Support\Admin\PasswordPolicy;
use Illuminate\Foundation\Http\FormRequest;

class AdminSetupRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $complete = $this->routeIs('admin.auth.setup.complete');

        return [
            'current_password' => ['required', 'string', 'max:1024'],
            'password' => $this->user()?->admin_setup_required ? ['required', 'string', 'confirmed', PasswordPolicy::rule()] : ['prohibited'],
            'challenge_id' => $complete ? ['required', 'uuid'] : ['prohibited'],
            'verification_code' => $complete ? ['required', 'string', 'regex:/^[0-9]{6}$/'] : ['prohibited'],
        ];
    }
}
