<?php

namespace App\Http\Requests\Customer;

use App\Enums\UserSex;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class UpdateAccountProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:255'],
            'middle_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'contact_number' => ['required', 'string', 'max:32'],
            'sex' => ['required', new Enum(UserSex::class)],
            'birth_date' => ['required', 'date', 'before:today'],
            'id' => ['prohibited'],
            'user_id' => ['prohibited'],
            'email' => ['prohibited'],
            'current_password' => ['prohibited'],
            'password' => ['prohibited'],
            'password_confirmation' => ['prohibited'],
            'role' => ['prohibited'],
            'status' => ['prohibited'],
            'profile_photo_path' => ['prohibited'],
            'profile_photo_url' => ['prohibited'],
            'profile_photo_disk' => ['prohibited'],
            'profile_photo_mime' => ['prohibited'],
            'profile_photo_size' => ['prohibited'],
            'profile_photo_width' => ['prohibited'],
            'profile_photo_height' => ['prohibited'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $middleName = trim((string) $this->input('middle_name'));

        $this->merge([
            'first_name' => trim((string) $this->input('first_name')),
            'middle_name' => $middleName !== '' ? $middleName : null,
            'last_name' => trim((string) $this->input('last_name')),
            'contact_number' => trim((string) $this->input('contact_number')),
        ]);
    }
}
