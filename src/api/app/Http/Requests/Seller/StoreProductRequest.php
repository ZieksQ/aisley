<?php

namespace App\Http\Requests\Seller;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreProductRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'sku' => strtoupper(trim((string) $this->input('sku'))),
            'variants' => collect($this->input('variants', []))->map(fn ($variant) => is_array($variant)
                ? [...$variant, 'sku' => strtoupper(trim((string) ($variant['sku'] ?? '')))]
                : $variant)->all(),
        ]);
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
            'sku' => ['required', 'string', 'max:80', 'alpha_dash'],
            'short_description' => ['nullable', 'string', 'max:500'],
            'description_markdown' => ['nullable', 'string', 'max:50000'],
            'description_asset_ids' => ['array', 'max:'.config('seller.products.description_image_limit')],
            'description_asset_ids.*' => ['uuid', 'distinct'],
            'gallery_upload_ids' => ['array', 'max:'.config('seller.products.gallery_image_limit')],
            'gallery_upload_ids.*' => ['uuid', 'distinct'],
            'gallery_media_ids' => ['array', 'max:'.config('seller.products.gallery_image_limit')],
            'gallery_media_ids.*' => ['uuid', 'distinct'],
            'default_gallery_upload_id' => ['nullable', 'uuid'],
            'upload_token' => ['nullable', 'uuid'],
            'price' => ['required', 'decimal:0,2', 'min:0.01', 'max:99999999.99'],
            'original_price' => ['nullable', 'decimal:0,2', 'gte:price', 'max:99999999.99'],
            'currency' => ['sometimes', Rule::in(['PHP'])],
            'opening_stock' => ['required_without:variants', 'nullable', 'integer', 'min:0', 'max:999999999'],
            'option_groups' => ['array', 'max:3'],
            'option_groups.*.name' => ['required', 'string', 'max:60'],
            'option_groups.*.values' => ['required', 'array', 'min:1', 'max:20'],
            'option_groups.*.values.*' => ['required', 'string', 'max:80'],
            'variants' => ['array', 'max:500'],
            'variants.*.id' => ['nullable', 'uuid', 'distinct'],
            'variants.*.sku' => ['required', 'string', 'max:80', 'alpha_dash'],
            'variants.*.opening_stock' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:999999999'],
            'variants.*.price' => ['nullable', 'decimal:0,2', 'min:0.01', 'max:99999999.99'],
            'variants.*.original_price' => ['nullable', 'decimal:0,2', 'max:99999999.99'],
            'variants.*.status' => ['sometimes', Rule::in(['active', 'inactive'])],
            'variants.*.option_value_indexes' => ['required', 'array'],
            'variants.*.option_value_indexes.*' => ['required', 'integer', 'min:0'],
            'variants.*.image_upload_id' => ['nullable', 'uuid'],
        ];
    }

    public function after(): array
    {
        return [function (Validator $validator): void {
            $this->validateSkuScope($validator);
            $this->validateOptionsAndVariants($validator);
            $this->validateMarkdown($validator);
            $this->validateDefaultGallery($validator);
        }];
    }

    protected function validateSkuScope(Validator $validator): void
    {
        $shopId = $this->user()?->shop?->id;
        if (! $shopId) {
            return;
        }
        $skus = collect([$this->input('sku'), ...collect($this->input('variants', []))->pluck('sku')])->filter()->map(fn ($sku) => strtoupper(trim((string) $sku)))->values();
        if ($skus->count() !== $skus->unique()->count()) {
            $validator->errors()->add('variants', 'SKUs must be unique within this Product.');
        }
        foreach ($skus as $index => $sku) {
            if (DB::table('inventory_skus')->where('shop_id', $shopId)->whereRaw('UPPER(code) = ?', [$sku])->exists()) {
                $validator->errors()->add($index === 0 ? 'sku' : 'variants.'.($index - 1).'.sku', 'This SKU is already used in your Shop.');
            }
            if (DB::table('products')->where('shop_id', $shopId)->whereRaw('UPPER(base_sku) = ?', [$sku])->exists()) {
                $validator->errors()->add($index === 0 ? 'sku' : 'variants.'.($index - 1).'.sku', 'This SKU is already used in your Shop.');
            }
        }
    }

    private function validateOptionsAndVariants(Validator $validator): void
    {
        $groups = collect($this->input('option_groups', []));
        $variants = collect($this->input('variants', []));
        $normalizedNames = $groups->pluck('name')->map(fn ($name) => Str::lower(trim((string) $name)));
        if ($normalizedNames->contains('') || $normalizedNames->unique()->count() !== $normalizedNames->count()) {
            $validator->errors()->add('option_groups', 'Option names must be nonblank and unique.');
        }
        foreach ($groups as $groupIndex => $group) {
            $values = collect($group['values'] ?? [])->map(fn ($value) => Str::lower(trim((string) $value)));
            if ($values->contains('') || $values->unique()->count() !== $values->count()) {
                $validator->errors()->add("option_groups.{$groupIndex}.values", 'Option values must be nonblank and unique.');
            }
        }
        if ($groups->isEmpty() && $variants->isNotEmpty()) {
            $validator->errors()->add('variants', 'Variants require at least one option group.');

            return;
        }
        $combinations = [];
        foreach ($variants as $index => $variant) {
            $selection = $variant['option_value_indexes'] ?? [];
            if (count($selection) !== $groups->count()) {
                $validator->errors()->add("variants.{$index}.option_value_indexes", 'Select exactly one value from every option group.');

                continue;
            }
            foreach ($selection as $groupIndex => $valueIndex) {
                if (! isset($groups[$groupIndex]['values'][$valueIndex])) {
                    $validator->errors()->add("variants.{$index}.option_value_indexes.{$groupIndex}", 'Select a valid option value.');
                }
            }
            $key = implode(':', $selection);
            if (isset($combinations[$key])) {
                $validator->errors()->add("variants.{$index}.option_value_indexes", 'This option combination is duplicated.');
            }
            $combinations[$key] = true;

            $effectivePrice = $variant['price'] ?? $this->input('price');
            $effectiveOriginal = $variant['original_price'] ?? $this->input('original_price');
            if ($effectiveOriginal !== null && (float) $effectiveOriginal < (float) $effectivePrice) {
                $validator->errors()->add("variants.{$index}.original_price", 'Original price cannot be lower than the effective selling price.');
            }
        }
    }

    private function validateMarkdown(Validator $validator): void
    {
        $markdown = (string) $this->input('description_markdown', '');
        if (preg_match('/<[^>]+>|\b(?:import|export)\s+|\{[^\r\n]*\}|(?:javascript|data|blob):/i', $markdown)) {
            $validator->errors()->add('description_markdown', 'Raw HTML, executable MDX, data/blob URLs, and scriptable links are not allowed.');
        }
        preg_match_all('/!?\[[^\]]*\]\(([^)]+)\)/', $markdown, $links);
        if (count($links[1] ?? []) > 50) {
            $validator->errors()->add('description_markdown', 'The description may contain at most 50 links and images.');
        }
        foreach ($links[0] ?? [] as $index => $syntax) {
            $url = trim((string) ($links[1][$index] ?? ''));
            if (str_starts_with($syntax, '!')) {
                if (! preg_match('~^/api/v1/product-description-assets/[0-9a-f-]{36}$~i', $url)) {
                    $validator->errors()->add('description_markdown', 'Description images must use an Aisley Product asset URL.');
                }
            } elseif (! preg_match('~^(https?://|/|#)~i', $url)) {
                $validator->errors()->add('description_markdown', 'Links must use HTTP, HTTPS, an internal path, or a page anchor.');
            }
        }
    }

    private function validateDefaultGallery(Validator $validator): void
    {
        $defaultId = $this->input('default_gallery_upload_id');
        if ($defaultId !== null && ! in_array($defaultId, $this->input('gallery_upload_ids', []), true)) {
            $validator->errors()->add('default_gallery_upload_id', 'The default image must be one of the Product gallery images.');
        }
    }
}
