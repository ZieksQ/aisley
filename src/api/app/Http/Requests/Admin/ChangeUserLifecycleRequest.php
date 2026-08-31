<?php

namespace App\Http\Requests\Admin;

use App\Enums\UserStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ChangeUserLifecycleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'expected_status' => ['required', Rule::enum(UserStatus::class)],
            'reason' => [
                Rule::requiredIf(in_array($this->route()?->getName(), [
                    'admin.users.suspend',
                    'admin.users.deactivate',
                ], true)),
                'nullable',
                'string',
                'min:3',
                'max:1000',
            ],
            'role' => ['prohibited'],
            'status' => ['prohibited'],
            'email' => ['prohibited'],
            'password' => ['prohibited'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('reason') && is_string($this->input('reason'))) {
            $this->merge(['reason' => trim((string) $this->input('reason'))]);
        }
    }
}
