<?php

namespace Database\Seeders;

use App\Enums\ProductStatus;
use App\Enums\ProductVariantStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserSex;
use App\Enums\UserStatus;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\ProductOptionGroup;
use App\Models\ProductOptionValue;
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
                ['password' => Str::random(40), 'status' => UserStatus::Active, 'email_verified_at' => now()],
            );
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
            $shop = Shop::query()->updateOrCreate(
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

            $categories = collect([
                'audio-video-equipment' => 'electronics-and-gadgets-audio-video-equipment',
                'cameras-photography' => 'electronics-and-gadgets-cameras-photography',
                'mens-shoes-accessories' => 'mens-apparel-shoes-accessories',
                'watches-men-women' => 'jewelry-and-watches-watches-for-men-women',
            ])->mapWithKeys(fn (string $slug, string $key) => [
                $key => Category::query()->where('slug', $slug)->firstOrFail(),
            ]);

            foreach ($this->catalog() as $definition) {
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

                $product = Product::query()->updateOrCreate(
                    ['slug' => $definition['slug']],
                    [
                        ...$definition,
                        'shop_id' => $shop->id,
                        'category_id' => $category->id,
                        'thumbnail_disk' => 'public',
                        'thumbnail_path' => $media[0]['path'],
                        'status' => ProductStatus::Active,
                        'published_at' => now()->subDay(),
                    ],
                );

                $values = $this->seedOptions($product, $optionGroups);
                $seededVariants = $this->seedVariants($product, $variants, $values);
                $seededMedia = $this->seedMedia($product, $media, $seededVariants);

                foreach ($variants as $variant) {
                    if (isset($variant['primary_media_position'])) {
                        $seededVariants[$variant['sku']]->update([
                            'primary_media_id' => $seededMedia[$variant['primary_media_position']]->id,
                        ]);
                    }
                }
            }
        });
    }

    /**
     * @param  list<array{name: string, values: list<array{value: string, color?: string}>}>  $groups
     * @return array<string, ProductOptionValue>
     */
    private function seedOptions(Product $product, array $groups): array
    {
        $values = [];
        foreach ($groups as $groupPosition => $groupDefinition) {
            $group = ProductOptionGroup::query()->updateOrCreate(
                ['product_id' => $product->id, 'position' => $groupPosition],
                ['name' => $groupDefinition['name']],
            );
            foreach ($groupDefinition['values'] as $valuePosition => $valueDefinition) {
                $value = ProductOptionValue::query()->updateOrCreate(
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
            $variant = ProductVariant::query()->updateOrCreate(
                ['sku' => $definition['sku']],
                [
                    'product_id' => $product->id,
                    'price' => $definition['price'] ?? null,
                    'original_price' => $definition['original_price'] ?? null,
                    'stock_quantity' => $definition['stock_quantity'],
                    'status' => ProductVariantStatus::Active,
                ],
            );
            $variant->optionValues()->sync(
                collect($definition['options'])->map(fn (string $key) => $values[$key]->id)->all(),
            );
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
            $seeded[$position] = ProductMedia::query()->updateOrCreate(
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

    /** @return list<array<string, mixed>> */
    private function catalog(): array
    {
        return [
            $this->headphones(),
            $this->camera(),
            $this->sneakers(),
            $this->watch(),
        ];
    }

    /** @return array<string, mixed> */
    private function headphones(): array
    {
        return [
            'slug' => 'studio-wireless-headphones',
            'category' => 'audio-video-equipment',
            'name' => 'Studio Wireless Headphones',
            'short_description' => 'Comfortable over-ear headphones for focused listening.',
            'description_markdown' => "## Immersive sound, all day\n\nEnjoy balanced wireless audio with soft memory-foam ear cushions and a fold-flat design.\n\n- Up to **30 hours** of listening\n- USB-C quick charging\n- Built-in microphone for clear calls",
            'specifications' => ['Battery life' => 'Up to 30 hours', 'Connectivity' => 'Bluetooth 5.3', 'Weight' => '250 g'],
            'price' => 3999,
            'original_price' => 4999,
            'stock_quantity' => 32,
            'average_rating' => 4.80,
            'review_count' => 124,
            'sold_count' => 381,
            'badges' => ['best_seller', 'free_shipping'],
            'is_promoted' => true,
            'media' => [
                ['path' => 'https://images.unsplash.com/photo-1547932087-59a8f2be576e?auto=format&fit=crop&w=1200&q=80', 'alt_text' => 'Black studio headphones on a desk'],
                ['path' => 'https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=1200&q=80', 'alt_text' => 'Black over-ear headphones', 'variant_sku' => 'AWH-BLK'],
                ['path' => 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=80', 'alt_text' => 'Silver over-ear headphones', 'variant_sku' => 'AWH-SLV'],
            ],
            'option_groups' => [[
                'name' => 'Color',
                'values' => [
                    ['value' => 'Black', 'color' => '#171717'],
                    ['value' => 'Silver', 'color' => '#c0c0c0'],
                ],
            ]],
            'variants' => [
                ['sku' => 'AWH-BLK', 'stock_quantity' => 20, 'options' => ['Color:Black'], 'primary_media_position' => 1],
                ['sku' => 'AWH-SLV', 'price' => 4199, 'original_price' => 4999, 'stock_quantity' => 12, 'options' => ['Color:Silver'], 'primary_media_position' => 2],
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function camera(): array
    {
        return [
            'slug' => 'compact-everyday-camera',
            'category' => 'cameras-photography',
            'name' => 'Compact Everyday Camera',
            'short_description' => 'A lightweight camera for daily memories and travel.',
            'description_markdown' => "## Ready for everyday moments\n\nA compact camera with straightforward controls, crisp stills, and lightweight construction for day trips and holidays.",
            'specifications' => ['Sensor' => '24 MP APS-C', 'Video' => '4K UHD', 'Weight' => '410 g'],
            'price' => 6750,
            'original_price' => 7900,
            'stock_quantity' => 14,
            'average_rating' => 4.70,
            'review_count' => 67,
            'sold_count' => 176,
            'badges' => ['free_shipping'],
            'is_promoted' => true,
            'media' => [
                ['path' => 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=1200&q=80', 'alt_text' => 'Compact camera viewed from the front'],
                ['path' => 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80', 'alt_text' => 'Compact camera held in one hand'],
                ['path' => 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=1200&q=80', 'alt_text' => 'Camera ready for travel photography'],
            ],
            'option_groups' => [],
            'variants' => [],
        ];
    }

    /** @return array<string, mixed> */
    private function sneakers(): array
    {
        return [
            'slug' => 'city-runner-sneakers',
            'category' => 'mens-shoes-accessories',
            'name' => 'City Runner Sneakers',
            'short_description' => 'Cushioned sneakers made for everyday movement.',
            'description_markdown' => "## Made to keep moving\n\nBreathable city sneakers with a cushioned midsole and flexible rubber outsole. See the size choices for currently available combinations.",
            'specifications' => ['Upper' => 'Breathable mesh', 'Outsole' => 'Rubber', 'Fit' => 'True to size'],
            'price' => 2890,
            'original_price' => 3500,
            'stock_quantity' => 26,
            'average_rating' => 4.60,
            'review_count' => 92,
            'sold_count' => 245,
            'badges' => ['new_arrival'],
            'is_promoted' => false,
            'media' => [
                ['path' => 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=1200&q=80', 'alt_text' => 'Red city runner sneaker'],
                ['path' => 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&w=1200&q=80', 'alt_text' => 'White city runner sneaker', 'variant_sku' => 'CRS-WHT-40'],
                ['path' => 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1200&q=80', 'alt_text' => 'White city runner sneaker side view', 'variant_sku' => 'CRS-WHT-41'],
            ],
            'option_groups' => [
                ['name' => 'Color', 'values' => [
                    ['value' => 'Red', 'color' => '#dc2626'],
                    ['value' => 'White', 'color' => '#f8fafc'],
                ]],
                ['name' => 'Size', 'values' => [['value' => '40'], ['value' => '41']]],
            ],
            'variants' => [
                ['sku' => 'CRS-RED-40', 'stock_quantity' => 10, 'options' => ['Color:Red', 'Size:40'], 'primary_media_position' => 0],
                ['sku' => 'CRS-RED-41', 'stock_quantity' => 0, 'options' => ['Color:Red', 'Size:41'], 'primary_media_position' => 0],
                ['sku' => 'CRS-WHT-40', 'stock_quantity' => 8, 'options' => ['Color:White', 'Size:40'], 'primary_media_position' => 1],
                ['sku' => 'CRS-WHT-41', 'price' => 2990, 'stock_quantity' => 8, 'options' => ['Color:White', 'Size:41'], 'primary_media_position' => 2],
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function watch(): array
    {
        return [
            'slug' => 'classic-everyday-watch',
            'category' => 'watches-men-women',
            'name' => 'Classic Everyday Watch',
            'short_description' => 'A clean, timeless watch for daily wear.',
            'description_markdown' => "## A timeless daily essential\n\nA slim analog watch with a clean dial, mineral glass, and comfortable leather strap.",
            'specifications' => ['Case diameter' => '40 mm', 'Movement' => 'Quartz', 'Water resistance' => '3 ATM'],
            'price' => 4590,
            'original_price' => null,
            'stock_quantity' => 18,
            'average_rating' => 4.90,
            'review_count' => 58,
            'sold_count' => 164,
            'badges' => ['top_rated'],
            'is_promoted' => false,
            'media' => [
                ['path' => 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80', 'alt_text' => 'Classic everyday watch'],
                ['path' => 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=1200&q=80', 'alt_text' => 'Classic watch face and leather strap'],
                ['path' => 'https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?auto=format&fit=crop&w=1200&q=80', 'alt_text' => 'Classic watch worn on a wrist'],
            ],
            'option_groups' => [],
            'variants' => [],
        ];
    }
}
