<?php

namespace App\Http\Requests\Admin;

use App\Enums\UserSex;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class UpdateOwnProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'middle_name' => ['nullable', 'string', 'max:255'],
            'contact_number' => ['nullable', 'string', 'max:32'],
            'sex' => ['nullable', new Enum(UserSex::class)],
            'birth_date' => ['nullable', 'date', 'before:today'],
            'role' => ['prohibited'],
            'status' => ['prohibited'],
            'permissions' => ['prohibited'],
        ];
    }
}
