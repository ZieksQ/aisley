<?php

namespace App\Http\Requests\Customer;

use Illuminate\Foundation\Http\FormRequest;

class WishlistStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'product_ids' => ['required', 'array', 'min:1', 'max:50'],
            'product_ids.*' => ['required', 'uuid', 'distinct'],
        ];
    }
}
