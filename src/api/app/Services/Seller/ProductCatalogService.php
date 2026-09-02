<?php

namespace App\Services\Seller;

use App\Enums\ProductStatus;
use App\Enums\ProductVariantStatus;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ProductCatalogService
{
    public function __construct(
        private readonly InventoryService $inventory,
        private readonly ProductAssetService $assets,
    ) {}

    public function create($shop, User $seller, array $data): Product
    {
        $data['upload_token'] ??= (string) Str::uuid();

        return DB::transaction(function () use ($shop, $seller, $data): Product {
            $variants = $data['variants'] ?? [];
            $product = $shop->products()->create([
                ...Arr::only($data, ['category_id', 'name', 'short_description', 'description_markdown', 'price', 'original_price', 'currency']),
                'slug' => Str::slug($data['name']).'-'.Str::lower(Str::random(6)),
                'base_sku' => $data['sku'],
                'stock_quantity' => 0,
                'status' => ProductStatus::Draft,
                'currency' => $data['currency'] ?? 'PHP',
            ]);

            if ($variants === []) {
                $this->inventory->createBaseSku($product, $data['sku'], (int) ($data['opening_stock'] ?? 0), $seller);
            } else {
                $this->createVariants($product, $seller, $data['option_groups'], $variants, $data['upload_token']);
            }
            $this->assets->claimGallery($product, $data['upload_token'], $data['gallery_upload_ids'] ?? [], $data['default_gallery_upload_id'] ?? null);
            $this->assets->claimDescription($product, $data['upload_token'], $data['description_asset_ids'] ?? [], (string) ($data['description_markdown'] ?? ''));

            return $product;
        });
    }

    public function update(Product $product, User $seller, array $data): Product
    {
        $data['upload_token'] ??= (string) Str::uuid();

        return DB::transaction(function () use ($product, $seller, $data): Product {
            $product->update(Arr::only($data, ['category_id', 'name', 'short_description', 'description_markdown', 'price', 'original_price', 'currency']));
            if (array_key_exists('variants', $data)) {
                $this->replaceVariants($product, $seller, $data['option_groups'] ?? [], $data['variants'], $data['upload_token']);
            }
            if (array_key_exists('gallery_upload_ids', $data)) {
                $this->assets->claimGallery($product, $data['upload_token'], $data['gallery_upload_ids'], $data['default_gallery_upload_id'] ?? null);
            } elseif (array_key_exists('default_gallery_media_id', $data)) {
                $this->assets->setDefaultGalleryMedia($product, $data['default_gallery_media_id']);
            }
            if (array_key_exists('description_markdown', $data)) {
                $this->assets->claimDescription($product, $data['upload_token'], $data['description_asset_ids'] ?? [], (string) ($data['description_markdown'] ?? ''));
            }

            return $product;
        });
    }

    private function replaceVariants(Product $product, User $seller, array $groups, array $variants, string $uploadToken): void
    {
        $skus = $product->inventorySkus()->with(['balance.movements'])->get();
        if ($skus->contains(fn ($sku) => ($sku->balance?->on_hand ?? 0) > 0 || ($sku->balance?->reserved ?? 0) > 0 || ($sku->balance?->movements->isNotEmpty() ?? false))) {
            throw ValidationException::withMessages(['variants' => 'Move existing SKU stock to zero in Inventory before changing the variant matrix.']);
        }
        $nextPosition = (int) ProductMedia::withTrashed()->where('product_id', $product->id)->max('position') + 1;
        $product->media()->whereNotNull('product_variant_id')->orderBy('position')->get()->values()->each(function ($media, int $index) use ($nextPosition): void {
            $media->update(['position' => $nextPosition + $index, 'purge_after' => now()->addHours((int) config('seller.products.replacement_retention_hours'))]);
            $media->delete();
        });
        foreach ($skus as $sku) {
            $sku->balance?->delete();
            $sku->delete();
        }
        $product->variants()->delete();
        $product->optionGroups()->delete();

        if ($variants !== []) {
            $this->createVariants($product, $seller, $groups, $variants, $uploadToken);
        }
    }

    private function createVariants(Product $product, User $seller, array $groups, array $variants, string $uploadToken): void
    {
        $valueIds = [];
        foreach (array_values($groups) as $groupIndex => $groupData) {
            $group = $product->optionGroups()->create(['name' => trim($groupData['name']), 'position' => $groupIndex]);
            foreach (array_values($groupData['values']) as $valueIndex => $label) {
                $value = $group->values()->create(['value' => trim($label), 'position' => $valueIndex]);
                $valueIds[$groupIndex][$valueIndex] = $value->id;
            }
        }

        foreach (array_values($variants) as $position => $variantData) {
            $variant = $product->variants()->create([
                'shop_id' => $product->shop_id,
                'sku' => $variantData['sku'],
                'price' => $variantData['price'] ?? null,
                'original_price' => $variantData['original_price'] ?? null,
                'stock_quantity' => 0,
                'status' => $variantData['status'] ?? ProductVariantStatus::Active,
            ]);
            $variant->optionValues()->sync(collect($variantData['option_value_indexes'])->map(fn ($valueIndex, $groupIndex) => $valueIds[$groupIndex][$valueIndex])->all());
            $this->inventory->createVariantSku($product, $variant, $variantData['sku'], $seller, (int) ($variantData['opening_stock'] ?? 0));
            if (! empty($variantData['image_upload_id'])) {
                $media = $this->assets->claimVariantImage($product, $uploadToken, $variantData['image_upload_id'], $variant->id, $position);
                $variant->update(['primary_media_id' => $media->id]);
            }
        }
    }
}
