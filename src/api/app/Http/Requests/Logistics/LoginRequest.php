<?php

namespace App\Http\Requests\Logistics;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['email' => ['required', 'string', 'email', 'max:255'], 'password' => ['required', 'string'], 'remember' => ['sometimes', 'boolean'], 'role' => ['prohibited'], 'device_name' => ['prohibited']];
    }

    public function throttleKey(): string
    {
        return 'logistics-login|'.Str::transliterate(Str::lower((string) $this->input('email')).'|'.$this->ip());
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['email' => Str::lower(trim((string) $this->input('email')))]);
    }
}
