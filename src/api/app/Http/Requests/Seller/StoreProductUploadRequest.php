<?php

namespace App\Http\Requests\Seller;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProductUploadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'image' => ['required', 'file', 'max:10239'],
            'purpose' => ['required', Rule::in(['gallery', 'variant', 'description'])],
            'upload_token' => ['required', 'uuid'],
            'alt_text' => ['nullable', 'string', 'max:300'],
        ];
    }
}
