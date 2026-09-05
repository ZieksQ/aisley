<?php

namespace App\Http\Requests\Logistics;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class ResetPasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['email' => ['required', 'string', 'email', 'max:255'], 'token' => ['required', 'string'], 'password' => ['required', 'string', 'confirmed', Password::min(8)->mixedCase()->numbers()]];
    }

    public function throttleKey(): string
    {
        return 'logistics-password-update|'.Str::transliterate((string) $this->input('email')).'|'.$this->ip();
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['email' => Str::lower(trim((string) $this->input('email')))]);
    }
}
