<?php

namespace App\Http\Requests\Seller;

use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Validator;

class UpdateProductRequest extends StoreProductRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('variants')) {
            $this->merge(['variants' => collect($this->input('variants', []))->map(fn ($variant) => is_array($variant)
                ? [...$variant, 'sku' => strtoupper(trim((string) ($variant['sku'] ?? '')))]
                : $variant)->all()]);
        }
    }

    public function rules(): array
    {
        $rules = parent::rules();
        unset($rules['sku'], $rules['opening_stock']);

        return array_map(fn (array $rule) => array_merge(['sometimes'], array_values(array_filter($rule, fn ($value) => $value !== 'required'))), $rules);
    }

    protected function validateSkuScope(Validator $validator): void
    {
        $shopId = $this->user()?->shop?->id;
        $productId = $this->route('product')?->id;
        $skus = collect($this->input('variants', []))->pluck('sku')->filter()->map(fn ($sku) => strtoupper(trim((string) $sku)))->values();
        if ($skus->count() !== $skus->unique()->count()) {
            $validator->errors()->add('variants', 'Variant SKUs must be unique within this Product.');
        }
        foreach ($skus as $index => $sku) {
            if (DB::table('inventory_skus')->where('shop_id', $shopId)->where('product_id', '!=', $productId)->whereRaw('UPPER(code) = ?', [$sku])->exists()) {
                $validator->errors()->add("variants.{$index}.sku", 'This SKU is already used in your Shop.');
            }
            if (DB::table('products')->where('shop_id', $shopId)->where('id', '!=', $productId)->whereRaw('UPPER(base_sku) = ?', [$sku])->exists()) {
                $validator->errors()->add("variants.{$index}.sku", 'This SKU is already used in your Shop.');
            }
        }
    }
}
