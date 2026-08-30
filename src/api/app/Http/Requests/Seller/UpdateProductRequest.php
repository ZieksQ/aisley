<?php

namespace App\Http\Requests\Seller;

class UpdateProductRequest extends StoreProductRequest
{
    public function rules(): array
    {
        $rules = parent::rules();
        unset($rules['sku'], $rules['opening_stock']);

        return array_map(fn (array $rule) => array_merge(['sometimes'], array_values(array_filter($rule, fn ($value) => $value !== 'required'))), $rules);
    }
}
