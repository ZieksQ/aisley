<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class SellerComplianceOptionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'seller_search' => ['nullable', 'string', 'max:120'],
            'seller_id' => ['nullable', 'uuid'],
            'seller_page' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
