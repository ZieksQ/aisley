<?php

namespace App\Http\Requests\Seller;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListSellerOrdersRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['nullable', Rule::in(['placed', 'seller_processing', 'ready_for_pickup'])],
            'notification' => ['nullable', Rule::in(['unread', 'read'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ];
    }
}
