<?php

namespace App\Http\Requests\Courier;

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
        return ['email' => ['required', 'email', 'max:255'], 'password' => ['required', 'string'], 'device_name' => ['required', 'string', 'max:255'], 'role' => ['prohibited'], 'abilities' => ['prohibited']];
    }

    public function throttleKey(): string
    {
        return 'courier-login|'.Str::transliterate(Str::lower((string) $this->input('email')).'|'.$this->ip());
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['email' => Str::lower(trim((string) $this->input('email')))]);
    }
}
