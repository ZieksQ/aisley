<?php

namespace App\Http\Requests\Account;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\Validator;

class PasswordChangeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'current_password' => ['required', 'string', function (string $attribute, mixed $value, \Closure $fail): void {
                if (! $this->user() || ! Hash::check((string) $value, $this->user()->fresh()->password)) {
                    $fail('The password is incorrect.');
                }
            }],
            'password' => ['required', 'string', 'confirmed', Password::min(8)->mixedCase()->numbers()],
            'password_confirmation' => ['required', 'string'],
            'challenge_id' => ['required', 'uuid'],
            'verification_code' => ['required', 'string', 'regex:/^[0-9]{6}$/'],
        ];
    }

    protected function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            foreach (array_diff(array_keys($this->all()), array_keys($this->rules())) as $field) {
                $validator->errors()->add($field, 'This field is not allowed.');
            }
        });
    }
}
