<?php

namespace App\Http\Requests\Seller;

use Illuminate\Foundation\Http\FormRequest;

class StoreProductRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('sku')) {
            $this->merge(['sku' => strtoupper((string) $this->input('sku'))]);
        }
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:160'],
            'category_id' => ['required', 'uuid'],
            'sku' => ['required', 'string', 'max:80', 'alpha_dash', 'unique:inventory_skus,code'],
            'short_description' => ['nullable', 'string', 'max:500'],
            'description_markdown' => ['nullable', 'string', 'max:50000', 'not_regex:/<\s*(script|iframe|object|embed)\b/i'],
            'price' => ['required', 'numeric', 'min:0.01', 'max:99999999.99'],
            'original_price' => ['nullable', 'numeric', 'gte:price', 'max:99999999.99'],
            'opening_stock' => ['required', 'integer', 'min:0', 'max:999999999'],
        ];
    }
}
