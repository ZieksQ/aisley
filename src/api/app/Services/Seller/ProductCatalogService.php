<?php

namespace App\Services\Seller;

use App\Enums\InventorySkuStatus;
use App\Enums\ProductStatus;
use App\Enums\ProductVariantStatus;
use App\Models\Product;
use App\Models\ProductVariant;
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
            $hasOptionGroups = ! empty($data['option_groups'] ?? []);
            $product = $shop->products()->create([
                ...Arr::only($data, ['category_id', 'name', 'short_description', 'description_markdown', 'price', 'original_price', 'currency']),
                'slug' => Str::slug($data['name']).'-'.Str::lower(Str::random(6)),
                'base_sku' => $data['sku'],
                'stock_quantity' => 0,
                'status' => ProductStatus::Draft,
                'currency' => $data['currency'] ?? 'PHP',
            ]);

            if ($variants === [] && ! $hasOptionGroups) {
                $this->inventory->createBaseSku($product, $data['sku'], (int) ($data['opening_stock'] ?? 0), $seller);
            } elseif ($variants !== []) {
                $this->createVariants($product, $seller, $data['option_groups'], $variants, $data['upload_token']);
            }
            $this->assets->claimGallery($product, $data['upload_token'], $data['gallery_upload_ids'] ?? [], $data['default_gallery_upload_id'] ?? null, $data['gallery_media_ids'] ?? [], $data['default_gallery_media_id'] ?? null);
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
            if (array_key_exists('gallery_upload_ids', $data) || array_key_exists('gallery_media_ids', $data)) {
                $this->assets->claimGallery($product, $data['upload_token'], $data['gallery_upload_ids'] ?? [], $data['default_gallery_upload_id'] ?? null, $data['gallery_media_ids'] ?? [], $data['default_gallery_media_id'] ?? null);
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
        $existingVariants = $product->variants()->with(['inventorySku.balance', 'media'])->get()->keyBy('id');
        $submittedIds = collect($variants)->pluck('id')->filter()->values();
        foreach ($submittedIds as $variantId) {
            if (! $existingVariants->has($variantId)) {
                throw ValidationException::withMessages(['variants' => 'Every existing variant must belong to this Product.']);
            }
        }
        $existingVariants
            ->reject(fn (ProductVariant $variant) => $submittedIds->contains($variant->id))
            ->each(function (ProductVariant $variant): void {
                $this->assets->retireVariantMedia($variant);
                $variant->inventorySku?->update(['status' => InventorySkuStatus::Inactive]);
                $variant->delete();
            });
        $product->optionGroups()->delete();
        $valueIds = $this->createOptionGroups($product, $groups);

        foreach (array_values($variants) as $position => $variantData) {
            $variant = ! empty($variantData['id']) ? $existingVariants->get($variantData['id']) : null;
            if ($variant) {
                $variant->update([
                    'sku' => $variantData['sku'],
                    'price' => $variantData['price'] ?? null,
                    'original_price' => $variantData['original_price'] ?? null,
                    'status' => $variantData['status'] ?? ProductVariantStatus::Active,
                ]);
                $variant->inventorySku?->update(['code' => $variantData['sku']]);
            } else {
                $variant = $product->variants()->create([
                    'shop_id' => $product->shop_id,
                    'sku' => $variantData['sku'],
                    'price' => $variantData['price'] ?? null,
                    'original_price' => $variantData['original_price'] ?? null,
                    'stock_quantity' => 0,
                    'status' => $variantData['status'] ?? ProductVariantStatus::Active,
                ]);
                $this->inventory->createVariantSku($product, $variant, $variantData['sku'], $seller, (int) ($variantData['opening_stock'] ?? 0));
            }
            $variant->optionValues()->sync(collect($variantData['option_value_indexes'])->map(fn ($valueIndex, $groupIndex) => $valueIds[$groupIndex][$valueIndex])->all());
            if (! empty($variantData['image_upload_id'])) {
                $this->assets->retireVariantMedia($variant);
                $media = $this->assets->claimVariantImage($product, $uploadToken, $variantData['image_upload_id'], $variant->id, $position);
                $variant->update(['primary_media_id' => $media->id]);
            }
        }
        $product->update(['stock_quantity' => (int) $product->variants()->sum('stock_quantity')]);
    }

    /** @return array<int, array<int, string>> */
    private function createOptionGroups(Product $product, array $groups): array
    {
        $valueIds = [];
        foreach (array_values($groups) as $groupIndex => $groupData) {
            $group = $product->optionGroups()->create(['name' => trim($groupData['name']), 'position' => $groupIndex]);
            foreach (array_values($groupData['values']) as $valueIndex => $label) {
                $value = $group->values()->create(['value' => trim($label), 'position' => $valueIndex]);
                $valueIds[$groupIndex][$valueIndex] = $value->id;
            }
        }

        return $valueIds;
    }

    private function createVariants(Product $product, User $seller, array $groups, array $variants, string $uploadToken): void
    {
        $valueIds = $this->createOptionGroups($product, $groups);

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
