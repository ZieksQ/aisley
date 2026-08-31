<?php

namespace App\Http\Requests\Seller;

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
            'middle_name' => ['nullable', 'string', 'max:1'],
            'contact_number' => ['required', 'string', 'max:32'],
            'sex' => ['required', new Enum(UserSex::class)],
            'birth_date' => ['required', 'date', 'before:today'],
            'role' => ['prohibited'],
            'status' => ['prohibited'],
            'seller_id' => ['prohibited'],
            'shop_id' => ['prohibited'],
        ];
    }
}
