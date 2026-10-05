<?php

namespace Database\Seeders;

use App\Enums\AddressType;
use App\Enums\InventoryMovementType;
use App\Enums\InventorySkuStatus;
use App\Enums\ProductStatus;
use App\Enums\ProductVariantStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserSex;
use App\Enums\UserStatus;
use App\Models\Category;
use App\Models\InventoryBalance;
use App\Models\InventoryMovement;
use App\Models\InventorySku;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\ProductOptionGroup;
use App\Models\ProductOptionValue;
use App\Models\ProductReview;
use App\Models\ProductVariant;
use App\Models\Shop;
use App\Models\ShopCategory;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProductSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command?->warn('The demo catalog was not seeded in production.');

            return;
        }

        $this->call(MarketplaceCategorySeeder::class);

        DB::transaction(function (): void {
            $configuredEmail = config('seller.initial.email');
            $configuredPassword = config('seller.initial.password');
            $normalizedConfiguredEmail = is_string($configuredEmail)
                ? strtolower(trim($configuredEmail))
                : '';
            $hasConfiguredSeller = $normalizedConfiguredEmail !== ''
                && is_string($configuredPassword)
                && $configuredPassword !== '';
            $sellerEmail = $hasConfiguredSeller
                ? $normalizedConfiguredEmail
                : 'catalog@aisley.test';

            $seller = User::query()->firstOrCreate(
                ['email' => $sellerEmail, 'role' => UserRole::Seller],
                [
                    'password' => $hasConfiguredSeller ? $configuredPassword : Str::random(40),
                    'status' => UserStatus::Active,
                    'email_verified_at' => now(),
                ],
            );
            if ($seller->status !== UserStatus::Active) {
                $this->command?->warn('The demo catalog was not seeded because its configured Seller is inactive.');

                return;
            }

            $seller->sellerProfile()->firstOrCreate([], [
                'first_name' => config('seller.initial.first_name', 'Aisley'),
                'last_name' => config('seller.initial.last_name', 'Catalog'),
                'contact_number' => config('seller.initial.contact_number', '+639171234568'),
                'sex' => UserSex::PreferNotToSay,
                'birth_date' => config('seller.initial.birth_date', '1995-01-01'),
            ]);

            $shopCategory = ShopCategory::query()
                ->where('slug', 'electronics-and-gadgets')
                ->firstOrFail();
            $shop = Shop::query()->firstOrCreate(
                ['slug' => 'aisley-demo-store'],
                [
                    'seller_id' => $seller->id,
                    'shop_category_id' => $shopCategory->id,
                    'name' => 'Aisley Demo Store',
                    'description' => 'A seeded storefront catalog for local development.',
                    'status' => ShopStatus::Active,
                    'contact_email' => $seller->email,
                    'is_on_vacation' => false,
                    'vacation_message' => null,
                ],
            );

            if ($shop->seller_id !== $seller->id) {
                $this->command?->warn('The Aisley demo store belongs to another seller; its catalog was left unchanged.');

                return;
            }

            $this->seedPickupAddress($seller);

            $categories = collect([
                'audio-video-equipment' => 'electronics-and-gadgets-audio-video-equipment',
                'cameras-photography' => 'electronics-and-gadgets-cameras-photography',
                'mens-shoes-accessories' => 'mens-apparel-shoes-accessories',
                'watches-men-women' => 'jewelry-and-watches-watches-for-men-women',
            ])->mapWithKeys(fn (string $slug, string $key) => [
                $key => Category::query()->where('slug', $slug)->firstOrFail(),
            ]);

            foreach (app(DemoProductCatalog::class)->definitions() as $definition) {
                $category = $categories->get($definition['category']);
                $media = $definition['media'];
                $optionGroups = $definition['option_groups'];
                $variants = $definition['variants'];
                unset(
                    $definition['category'],
                    $definition['media'],
                    $definition['option_groups'],
                    $definition['variants'],
                );

                $product = $this->seedProduct($definition, $shop, $category, $media[0]['path']);
                if ($product === null) {
                    continue;
                }

                $this->refreshReviewProjection($product);

                $values = $this->seedOptions($product, $optionGroups);
                $seededVariants = $this->seedVariants($product, $variants, $values);
                $this->seedInventory($product, $seededVariants);
                $seededMedia = $this->seedMedia($product, $media, $seededVariants);

                foreach ($variants as $variant) {
                    if (isset($seededVariants[$variant['sku']]) && isset($variant['primary_media_position'])) {
                        $seededVariants[$variant['sku']]->newQuery()
                            ->whereKey($seededVariants[$variant['sku']]->id)
                            ->whereNull('primary_media_id')
                            ->update(['primary_media_id' => $seededMedia[$variant['primary_media_position']]->id]);
                    }
                }
            }
        });
    }

    private function refreshReviewProjection(Product $product): void
    {
        $aggregate = ProductReview::query()
            ->published()
            ->where('product_id', $product->id)
            ->selectRaw('COUNT(*) as review_count, AVG(rating) as average_rating')
            ->first();

        $product->forceFill([
            'review_count' => (int) ($aggregate?->review_count ?? 0),
            'average_rating' => $aggregate?->average_rating === null
                ? null
                : round((float) $aggregate->average_rating, 2),
        ])->save();
    }

    private function seedPickupAddress(User $seller): void
    {
        if ($seller->addresses()->exists()) {
            return;
        }

        $seller->addresses()->create([
            'type' => AddressType::Both,
            'label' => 'Shop pickup address',
            'recipient_name' => trim(config('seller.initial.first_name', 'Aisley').' '.config('seller.initial.last_name', 'Catalog')),
            'contact_number' => config('seller.initial.contact_number', '+639171234568'),
            'address_line_1' => config('seller.initial.address_line_1', '1 Seller Street'),
            'address_line_2' => config('seller.initial.address_line_2'),
            'barangay' => config('seller.initial.barangay', 'Poblacion'),
            'city_municipality' => config('seller.initial.city_municipality', 'Makati City'),
            'province' => config('seller.initial.province', 'Metro Manila'),
            'region' => config('seller.initial.region', 'National Capital Region (NCR)'),
            'postal_code' => config('seller.initial.postal_code', '1200'),
            'country' => 'Philippines',
            'is_default' => true,
        ]);
    }

    /** @param array<string, mixed> $definition */
    private function seedProduct(array $definition, Shop $shop, Category $category, string $thumbnailPath): ?Product
    {
        $existing = Product::query()->where('slug', $definition['slug'])->first();
        if ($existing !== null && $existing->shop_id !== $shop->id) {
            $this->command?->warn("Product {$definition['slug']} belongs to another shop; it was left unchanged.");

            return null;
        }

        $isNew = $existing === null;
        $product = $existing ?? new Product(['slug' => $definition['slug']]);
        $defaults = [
            ...$definition,
            'shop_id' => $shop->id,
            'category_id' => $category->id,
            'thumbnail_disk' => 'public',
            'thumbnail_path' => $thumbnailPath,
            'average_rating' => null,
            'review_count' => 0,
            'status' => ProductStatus::Active,
            'published_at' => now()->subDay(),
        ];

        foreach ($defaults as $column => $value) {
            if ($column === 'slug') {
                continue;
            }

            if ($isNew || $product->getAttribute($column) === null || $product->getAttribute($column) === '') {
                $product->setAttribute($column, $value);
            }
        }

        $product->save();

        return $product;
    }

    /** @param array<string, ProductVariant> $variants */
    private function seedInventory(Product $product, array $variants): void
    {
        $targets = $variants === []
            ? [[null, $product->base_sku, $product->stock_quantity]]
            : collect($variants)->map(fn (ProductVariant $variant) => [$variant, $variant->sku, $variant->stock_quantity])->all();

        foreach ($targets as [$variant, $code, $stock]) {
            $skuQuery = InventorySku::query()->when(
                $variant === null,
                fn ($query) => $query->where('product_id', $product->id)->where('is_base', true),
                fn ($query) => $query->where('product_variant_id', $variant->id),
            );
            $sku = $skuQuery->first();
            if ($sku === null) {
                $codeOwner = InventorySku::query()->where('code', $code)->first();
                if ($codeOwner !== null) {
                    $this->command?->warn("Inventory code {$code} is already assigned; its owner was left unchanged.");

                    continue;
                }

                $sku = InventorySku::query()->create([
                    'product_id' => $product->id,
                    'shop_id' => $product->shop_id,
                    'product_variant_id' => $variant?->id,
                    'code' => $code,
                    'is_base' => $variant === null,
                    'status' => InventorySkuStatus::Active,
                ]);
            }

            $balance = InventoryBalance::query()->firstOrCreate(
                ['inventory_sku_id' => $sku->id],
                ['on_hand' => $stock, 'reserved' => 0],
            );
            if ($balance->wasRecentlyCreated && $stock > 0) {
                InventoryMovement::create([
                    'inventory_balance_id' => $balance->id, 'movement_type' => InventoryMovementType::Restock,
                    'on_hand_delta' => $stock, 'reserved_delta' => 0, 'resulting_on_hand' => $stock,
                    'resulting_reserved' => 0, 'reference_type' => 'catalog_seed',
                    'idempotency_key' => 'catalog-seed-'.$sku->id, 'reason' => 'Opening balance from ProductSeeder.',
                ]);
            }

            $available = $balance->on_hand - $balance->reserved;
            if ($variant === null) {
                $product->forceFill(['stock_quantity' => $available])->save();
            } else {
                $variant->forceFill(['stock_quantity' => $available])->save();
            }
        }

        if ($variants !== []) {
            $product->forceFill([
                'stock_quantity' => (int) $product->variants()->sum('stock_quantity'),
            ])->save();
        }
    }

    /**
     * @param  list<array{name: string, values: list<array{value: string, color?: string}>}>  $groups
     * @return array<string, ProductOptionValue>
     */
    private function seedOptions(Product $product, array $groups): array
    {
        $values = [];
        foreach ($groups as $groupPosition => $groupDefinition) {
            $group = ProductOptionGroup::query()->firstOrCreate(
                ['product_id' => $product->id, 'position' => $groupPosition],
                ['name' => $groupDefinition['name']],
            );
            foreach ($groupDefinition['values'] as $valuePosition => $valueDefinition) {
                $value = ProductOptionValue::query()->firstOrCreate(
                    ['option_group_id' => $group->id, 'value' => $valueDefinition['value']],
                    [
                        'position' => $valuePosition,
                        'swatch_color' => $valueDefinition['color'] ?? null,
                        'swatch_image_path' => null,
                    ],
                );
                $values[$groupDefinition['name'].':'.$valueDefinition['value']] = $value;
            }
        }

        return $values;
    }

    /**
     * @param  list<array<string, mixed>>  $variants
     * @param  array<string, ProductOptionValue>  $values
     * @return array<string, ProductVariant>
     */
    private function seedVariants(Product $product, array $variants, array $values): array
    {
        $seeded = [];
        foreach ($variants as $definition) {
            $variant = ProductVariant::query()->where('sku', $definition['sku'])->first();
            if ($variant !== null && $variant->product_id !== $product->id) {
                $this->command?->warn("Variant SKU {$definition['sku']} belongs to another product; it was left unchanged.");

                continue;
            }

            $isNew = $variant === null;
            $variant ??= new ProductVariant(['sku' => $definition['sku'], 'product_id' => $product->id]);
            $defaults = [
                'shop_id' => $product->shop_id,
                'price' => $definition['price'] ?? null,
                'original_price' => $definition['original_price'] ?? null,
                'stock_quantity' => $definition['stock_quantity'],
                'status' => ProductVariantStatus::Active,
                'shipping_weight_grams' => $definition['shipping_weight_grams'] ?? null,
                'shipping_length_mm' => $definition['shipping_length_mm'] ?? null,
                'shipping_width_mm' => $definition['shipping_width_mm'] ?? null,
                'shipping_height_mm' => $definition['shipping_height_mm'] ?? null,
            ];
            foreach ($defaults as $column => $value) {
                if ($isNew || (str_starts_with($column, 'shipping_') && $variant->getAttribute($column) === null)) {
                    $variant->setAttribute($column, $value);
                }
            }
            $variant->save();
            if (! $variant->optionValues()->exists()) {
                $variant->optionValues()->syncWithoutDetaching(
                    collect($definition['options'])
                        ->filter(fn (string $key) => isset($values[$key]))
                        ->map(fn (string $key) => $values[$key]->id)
                        ->all(),
                );
            }
            $seeded[$variant->sku] = $variant;
        }

        return $seeded;
    }

    /**
     * @param  list<array<string, mixed>>  $media
     * @param  array<string, ProductVariant>  $variants
     * @return array<int, ProductMedia>
     */
    private function seedMedia(Product $product, array $media, array $variants): array
    {
        $seeded = [];
        foreach ($media as $position => $definition) {
            if (isset($definition['variant_sku']) && ! isset($variants[$definition['variant_sku']])) {
                $this->command?->warn("Product media for {$definition['variant_sku']} was skipped because its variant is unavailable.");

                continue;
            }

            $seeded[$position] = ProductMedia::query()->firstOrCreate(
                ['product_id' => $product->id, 'position' => $position],
                [
                    'product_variant_id' => isset($definition['variant_sku'])
                        ? $variants[$definition['variant_sku']]->id
                        : null,
                    'disk' => 'public',
                    'path' => $definition['path'],
                    'alt_text' => $definition['alt_text'],
                ],
            );
        }

        return $seeded;
    }
}
