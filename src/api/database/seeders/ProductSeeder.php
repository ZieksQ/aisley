<?php

namespace Database\Seeders;

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
                $this->seedInventory($product, $seededVariants);
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

    /** @param array<string, ProductVariant> $variants */
    private function seedInventory(Product $product, array $variants): void
    {
        $targets = $variants === []
            ? [[null, $product->base_sku, $product->stock_quantity]]
            : collect($variants)->map(fn (ProductVariant $variant) => [$variant, $variant->sku, $variant->stock_quantity])->all();

        foreach ($targets as [$variant, $code, $stock]) {
            $sku = InventorySku::query()->firstOrCreate(
                $variant === null ? ['product_id' => $product->id, 'is_base' => true] : ['product_variant_id' => $variant->id],
                [
                    'product_id' => $product->id,
                    'shop_id' => $product->shop_id,
                    'code' => $code,
                    'is_base' => $variant === null,
                    'status' => InventorySkuStatus::Active,
                ],
            );
            $sku->update([
                'shop_id' => $product->shop_id,
                'code' => $code,
                'status' => InventorySkuStatus::Active,
            ]);
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
                    'shop_id' => $product->shop_id,
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
            ...$this->expandedCatalog(),
        ];
    }

    /** @return list<array<string, mixed>> */
    private function expandedCatalog(): array
    {
        return [
            $this->simpleProduct('portable-bluetooth-speaker', 'audio-video-equipment', 'Portable Bluetooth Speaker', 'A compact speaker with clear sound for desks, picnics, and weekends away.', 1890, 2290, 41, 4.70, 88, 216, ['free_shipping'], true, 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=1200&q=80', 'Portable Bluetooth speaker on a neutral surface', ['Battery life' => 'Up to 16 hours', 'Connectivity' => 'Bluetooth 5.3', 'Water resistance' => 'IPX5']),
            $this->simpleProduct('mechanical-work-keyboard', 'audio-video-equipment', 'Mechanical Work Keyboard', 'A compact mechanical keyboard with tactile switches and a comfortable typing angle.', 3290, 3890, 28, 4.80, 112, 304, ['best_seller'], true, 'https://images.unsplash.com/photo-1587829741301-dc798b83adda?auto=format&fit=crop&w=1200&q=80', 'Mechanical keyboard on a desk', ['Layout' => '75%', 'Connection' => 'USB-C', 'Switch type' => 'Tactile']),
            $this->simpleProduct('wireless-precision-mouse', 'audio-video-equipment', 'Wireless Precision Mouse', 'An ergonomic wireless mouse designed for focused daily work.', 1290, 1590, 55, 4.60, 73, 190, ['free_shipping'], false, 'https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=1200&q=80', 'Wireless mouse beside a laptop', ['Connectivity' => 'Bluetooth and 2.4 GHz', 'Battery' => 'Up to 12 months', 'Sensor' => '4,000 DPI']),
            $this->simpleProduct('minimal-led-desk-lamp', 'audio-video-equipment', 'Minimal LED Desk Lamp', 'A slim adjustable lamp with warm-to-cool light for a more comfortable workspace.', 1490, 1890, 33, 4.50, 39, 97, ['new_arrival'], false, 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1200&q=80', 'Minimal desk lamp on a workspace', ['Light modes' => '3 colour temperatures', 'Power' => 'USB-C', 'Height' => '42 cm']),
            $this->simpleProduct('usb-c-fast-charger', 'audio-video-equipment', 'USB-C Fast Charger', 'A compact 30 W charger for phones, tablets, and travel kits.', 690, null, 80, 4.70, 61, 246, ['free_shipping'], false, 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=1200&q=80', 'USB-C charger and cable', ['Output' => '30 W', 'Ports' => '1 × USB-C', 'Plug' => 'Foldable']),
            $this->simpleProduct('everyday-laptop-sleeve', 'audio-video-equipment', 'Everyday Laptop Sleeve', 'A padded fabric sleeve that keeps a 14-inch laptop protected on the move.', 990, 1190, 48, 4.60, 46, 121, ['free_shipping'], false, 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80', 'Laptop in a protective sleeve', ['Compatibility' => 'Up to 14 inches', 'Material' => 'Recycled polyester', 'Closure' => 'Zipper']),
            $this->simpleProduct('compact-webcam', 'cameras-photography', 'Compact Full HD Webcam', 'A plug-and-play webcam with a privacy shutter for everyday calls.', 1590, 1990, 35, 4.40, 28, 74, ['new_arrival'], false, 'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?auto=format&fit=crop&w=1200&q=80', 'Webcam on top of a computer display', ['Resolution' => '1080p', 'Field of view' => '78 degrees', 'Connection' => 'USB-A']),
            $this->simpleProduct('creator-tripod-kit', 'cameras-photography', 'Creator Tripod Kit', 'A lightweight adjustable tripod for cameras, phones, and small lights.', 2190, 2690, 22, 4.70, 34, 82, ['free_shipping'], false, 'https://images.unsplash.com/photo-1502982720700-bfff97f2ecac?auto=format&fit=crop&w=1200&q=80', 'Camera tripod ready for a photo shoot', ['Maximum height' => '150 cm', 'Load capacity' => '3 kg', 'Material' => 'Aluminum']),
            $this->simpleProduct('camera-everyday-sling', 'cameras-photography', 'Camera Everyday Sling', 'A weather-resistant sling with padded dividers for a compact camera kit.', 2490, 2990, 19, 4.80, 21, 51, ['free_shipping'], false, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=80', 'Compact everyday carry bag', ['Capacity' => '6 L', 'Material' => 'Water-resistant nylon', 'Strap' => 'Adjustable']),
            $this->simpleProduct('lens-cleaning-kit', 'cameras-photography', 'Lens Cleaning Kit', 'A careful three-piece cleaning set for lenses, filters, and camera screens.', 490, null, 74, 4.50, 17, 63, ['free_shipping'], false, 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80', 'Camera lens prepared for cleaning', ['Includes' => 'Brush, blower, cloth', 'Use' => 'Lens and screen safe', 'Case' => 'Travel pouch']),
            $this->simpleProduct('daily-commute-backpack', 'mens-shoes-accessories', 'Daily Commute Backpack', 'A streamlined backpack with a padded laptop compartment and quick-access pockets.', 2190, 2690, 31, 4.70, 65, 173, ['best_seller'], true, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=80', 'Backpack resting against a wall', ['Capacity' => '20 L', 'Laptop sleeve' => 'Up to 15 inches', 'Material' => 'Water-resistant canvas']),
            $this->simpleProduct('canvas-weekend-tote', 'mens-shoes-accessories', 'Canvas Weekend Tote', 'A roomy, durable tote for groceries, books, and quick overnight plans.', 890, 1090, 46, 4.50, 32, 84, ['new_arrival'], false, 'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=1200&q=80', 'Canvas tote bag', ['Material' => 'Heavyweight canvas', 'Closure' => 'Magnetic snap', 'Capacity' => '18 L']),
            $this->simpleProduct('classic-leather-belt', 'mens-shoes-accessories', 'Classic Leather Belt', 'A versatile leather belt with a brushed-metal buckle for everyday outfits.', 790, null, 60, 4.60, 49, 157, ['free_shipping'], false, 'https://images.unsplash.com/photo-1624222247344-550fb60583dc?auto=format&fit=crop&w=1200&q=80', 'Classic leather belt', ['Material' => 'Genuine leather', 'Width' => '32 mm', 'Buckle' => 'Brushed alloy']),
            $this->simpleProduct('polarized-day-sunglasses', 'mens-shoes-accessories', 'Polarized Day Sunglasses', 'Lightweight polarized sunglasses with UV400 protection.', 1190, 1490, 37, 4.50, 36, 109, ['free_shipping'], false, 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=1200&q=80', 'Polarized sunglasses on a surface', ['Lens' => 'Polarized UV400', 'Frame' => 'TR90', 'Includes' => 'Protective pouch']),
            $this->simpleProduct('everyday-canvas-sneakers', 'mens-shoes-accessories', 'Everyday Canvas Sneakers', 'Simple low-top sneakers with a flexible outsole for relaxed daily wear.', 1990, 2490, 39, 4.60, 70, 184, ['free_shipping'], false, 'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=1200&q=80', 'Everyday canvas sneakers', ['Upper' => 'Canvas', 'Outsole' => 'Rubber', 'Closure' => 'Lace-up']),
            $this->simpleProduct('trail-ready-shoes', 'mens-shoes-accessories', 'Trail Ready Shoes', 'Supportive shoes with a grippy outsole for walks beyond the pavement.', 3490, 4190, 24, 4.70, 43, 119, ['top_rated'], false, 'https://images.unsplash.com/photo-1552346154-21d32810aba3?auto=format&fit=crop&w=1200&q=80', 'Trail shoes on a neutral background', ['Upper' => 'Ripstop mesh', 'Outsole' => 'High-traction rubber', 'Drop' => '8 mm']),
            $this->simpleProduct('minimalist-running-shoes', 'mens-shoes-accessories', 'Minimalist Running Shoes', 'Lightweight running shoes with breathable mesh and responsive foam.', 3190, 3790, 27, 4.60, 57, 142, ['new_arrival'], false, 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&w=1200&q=80', 'Minimalist running shoes', ['Upper' => 'Engineered mesh', 'Midsole' => 'Responsive foam', 'Weight' => '240 g']),
            $this->simpleProduct('woven-leather-wallet', 'mens-shoes-accessories', 'Woven Leather Wallet', 'A slim wallet with practical card slots and a full-length cash compartment.', 1090, 1390, 44, 4.50, 29, 88, ['free_shipping'], false, 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=1200&q=80', 'Slim leather wallet', ['Material' => 'Genuine leather', 'Card slots' => '6', 'RFID lining' => 'Included']),
            $this->simpleProduct('heritage-leather-watch', 'watches-men-women', 'Heritage Leather Watch', 'An understated analog watch with a warm leather strap and easy-to-read dial.', 3790, 4490, 25, 4.80, 77, 206, ['top_rated'], true, 'https://images.unsplash.com/photo-1508057198894-247b23fe5ade?auto=format&fit=crop&w=1200&q=80', 'Heritage watch with a leather strap', ['Case diameter' => '42 mm', 'Movement' => 'Quartz', 'Water resistance' => '5 ATM']),
            $this->simpleProduct('midnight-mesh-watch', 'watches-men-women', 'Midnight Mesh Watch', 'A refined black-dial watch paired with a comfortable mesh bracelet.', 4290, 4990, 18, 4.70, 42, 97, ['free_shipping'], false, 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=1200&q=80', 'Black watch with a mesh bracelet', ['Case diameter' => '40 mm', 'Movement' => 'Quartz', 'Glass' => 'Mineral']),
            $this->simpleProduct('silver-link-watch', 'watches-men-women', 'Silver Link Watch', 'A polished everyday watch with a classic bracelet and clean silver dial.', 3990, null, 23, 4.60, 35, 91, ['free_shipping'], false, 'https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?auto=format&fit=crop&w=1200&q=80', 'Silver link watch on a wrist', ['Case diameter' => '38 mm', 'Movement' => 'Quartz', 'Water resistance' => '3 ATM']),
            $this->simpleProduct('sport-silicone-watch', 'watches-men-women', 'Sport Silicone Watch', 'A durable everyday timepiece with a soft silicone strap.', 2890, 3490, 36, 4.50, 26, 70, ['new_arrival'], false, 'https://images.unsplash.com/photo-1547996160-81dfa63595aa?auto=format&fit=crop&w=1200&q=80', 'Sport watch with silicone strap', ['Case diameter' => '44 mm', 'Strap' => 'Silicone', 'Water resistance' => '5 ATM']),
            $this->simpleProduct('rose-gold-minimal-watch', 'watches-men-women', 'Rose Gold Minimal Watch', 'A delicate rose-gold watch with a minimalist face for polished daily style.', 4490, 5290, 16, 4.80, 31, 78, ['top_rated'], false, 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=1200&q=80', 'Rose gold minimalist watch', ['Case diameter' => '36 mm', 'Movement' => 'Quartz', 'Strap' => 'Stainless steel']),
            $this->simpleProduct('classic-field-watch', 'watches-men-women', 'Classic Field Watch', 'A practical field-style watch with luminous hands and a woven strap.', 3290, null, 29, 4.60, 24, 65, ['free_shipping'], false, 'https://images.unsplash.com/photo-1539874754764-5a96559165b0?auto=format&fit=crop&w=1200&q=80', 'Classic field watch', ['Case diameter' => '40 mm', 'Movement' => 'Quartz', 'Strap' => 'Nylon']),
            $this->simpleProduct('slim-metal-watch', 'watches-men-women', 'Slim Metal Watch', 'A slim silver watch that works from weekday meetings to weekends.', 3590, 4190, 21, 4.50, 19, 58, ['free_shipping'], false, 'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?auto=format&fit=crop&w=1200&q=80', 'Slim metal watch', ['Case diameter' => '39 mm', 'Movement' => 'Quartz', 'Water resistance' => '3 ATM']),
            $this->simpleProduct('everyday-analog-watch', 'watches-men-women', 'Everyday Analog Watch', 'A reliable analog watch with a clean dial, polished case, and comfortable strap.', 3390, 3990, 26, 4.60, 22, 61, ['free_shipping'], false, 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80', 'Everyday analog watch', ['Case diameter' => '41 mm', 'Movement' => 'Quartz', 'Strap' => 'Leather']),
        ];
    }

    /** @return array<string, mixed> */
    private function simpleProduct(string $slug, string $category, string $name, string $description, int $price, ?int $originalPrice, int $stock, float $rating, int $reviews, int $sold, array $badges, bool $promoted, string $image, string $altText, array $specifications): array
    {
        return [
            'slug' => $slug,
            'category' => $category,
            'name' => $name,
            'base_sku' => 'AIS-'.strtoupper(str_replace('-', '', $slug)),
            'short_description' => $description,
            'description_markdown' => "## {$name}\n\n{$description}",
            'specifications' => $specifications,
            'price' => $price,
            'original_price' => $originalPrice,
            'stock_quantity' => $stock,
            'average_rating' => $rating,
            'review_count' => $reviews,
            'sold_count' => $sold,
            'badges' => $badges,
            'is_promoted' => $promoted,
            'media' => [['path' => $image, 'alt_text' => $altText]],
            'option_groups' => [],
            'variants' => [],
        ];
    }

    /** @return array<string, mixed> */
    private function headphones(): array
    {
        return [
            'slug' => 'studio-wireless-headphones',
            'category' => 'audio-video-equipment',
            'name' => 'Studio Wireless Headphones',
            'base_sku' => 'AWH-BASE',
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
            'base_sku' => 'CEC-BASE',
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
            'base_sku' => 'CRS-BASE',
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
            'base_sku' => 'CEW-BASE',
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
