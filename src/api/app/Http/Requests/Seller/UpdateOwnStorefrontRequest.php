<?php

namespace App\Http\Requests\Seller;

use Illuminate\Foundation\Http\FormRequest;

class UpdateOwnStorefrontRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'contact_email' => ['nullable', 'email', 'max:255'],
            'contact_number' => ['nullable', 'string', 'max:32'],
            'website' => ['nullable', 'url:http,https', 'max:2048'],
            'is_on_vacation' => ['required', 'boolean'],
            'vacation_message' => ['nullable', 'string', 'max:1000', 'required_if:is_on_vacation,true'],
            'slug' => ['prohibited'],
            'status' => ['prohibited'],
            'seller_id' => ['prohibited'],
            'shop_category_id' => ['prohibited'],
        ];
    }
}
