<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

class RegistrationEmailRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:255'],
            'role' => ['prohibited'], 'status' => ['prohibited'], 'email_verified_at' => ['prohibited'],
            ...($this->routeIs('*.registration.verify-email') ? [
                'challenge_id' => ['required', 'uuid'],
                'verification_code' => ['required', 'string', 'regex:/^[0-9]{6}$/'],
            ] : []),
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['email' => Str::lower(trim((string) $this->input('email')))]);
    }
}
