<?php

namespace Database\Seeders;

use App\Enums\CategoryStatus;
use App\Enums\ProductStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserSex;
use App\Enums\UserStatus;
use App\Models\Category;
use App\Models\Product;
use App\Models\Shop;
use App\Models\ShopCategory;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class ProductSeeder extends Seeder
{
    public function run(): void
    {
        $seller = User::query()->firstOrCreate(
            [
                'email' => 'catalog@aisley.test',
                'role' => UserRole::Seller,
            ],
            [
                'password' => Str::random(40),
                'status' => UserStatus::Active,
                'email_verified_at' => now(),
            ],
        );

        $seller->sellerProfile()->firstOrCreate([], [
            'first_name' => 'Aisley',
            'last_name' => 'Catalog',
            'contact_number' => '+639171234568',
            'sex' => UserSex::PreferNotToSay,
            'birth_date' => '1995-01-01',
        ]);

        $shopCategory = ShopCategory::query()->firstOrCreate(
            ['slug' => 'general-merchandise'],
            [
                'name' => 'General Merchandise',
                'description' => 'Everyday products for the seeded marketplace catalog.',
                'status' => CategoryStatus::Active,
            ],
        );

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
            ],
        );

        $categories = collect([
            'electronics' => [
                'name' => 'Electronics',
                'description' => 'Audio and imaging essentials.',
            ],
            'fashion' => [
                'name' => 'Fashion',
                'description' => 'Everyday footwear and accessories.',
            ],
        ])->mapWithKeys(fn (array $category, string $slug) => [
            $slug => Category::query()->firstOrCreate(
                ['slug' => $slug],
                [...$category, 'status' => CategoryStatus::Active],
            ),
        ]);

        foreach ([
            [
                'slug' => 'studio-wireless-headphones',
                'category' => 'electronics',
                'name' => 'Studio Wireless Headphones',
                'short_description' => 'Comfortable over-ear headphones for focused listening.',
                'thumbnail_path' => 'https://images.unsplash.com/photo-1547932087-59a8f2be576e?auto=format&fit=crop&w=900&q=80',
                'price' => 3999,
                'original_price' => 4999,
                'stock_quantity' => 32,
                'average_rating' => 4.80,
                'review_count' => 124,
                'sold_count' => 381,
                'badges' => ['best_seller', 'free_shipping'],
                'is_promoted' => true,
            ],
            [
                'slug' => 'compact-everyday-camera',
                'category' => 'electronics',
                'name' => 'Compact Everyday Camera',
                'short_description' => 'A lightweight camera for daily memories and travel.',
                'thumbnail_path' => 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=900&q=80',
                'price' => 6750,
                'original_price' => 7900,
                'stock_quantity' => 14,
                'average_rating' => 4.70,
                'review_count' => 67,
                'sold_count' => 176,
                'badges' => ['free_shipping'],
                'is_promoted' => true,
            ],
            [
                'slug' => 'city-runner-sneakers',
                'category' => 'fashion',
                'name' => 'City Runner Sneakers',
                'short_description' => 'Cushioned sneakers made for everyday movement.',
                'thumbnail_path' => 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',
                'price' => 2890,
                'original_price' => 3500,
                'stock_quantity' => 26,
                'average_rating' => 4.60,
                'review_count' => 92,
                'sold_count' => 245,
                'badges' => ['new_arrival'],
                'is_promoted' => false,
            ],
            [
                'slug' => 'classic-everyday-watch',
                'category' => 'fashion',
                'name' => 'Classic Everyday Watch',
                'short_description' => 'A clean, timeless watch for daily wear.',
                'thumbnail_path' => 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80',
                'price' => 4590,
                'original_price' => null,
                'stock_quantity' => 18,
                'average_rating' => 4.90,
                'review_count' => 58,
                'sold_count' => 164,
                'badges' => ['top_rated'],
                'is_promoted' => false,
            ],
        ] as $product) {
            $categorySlug = $product['category'];
            unset($product['category']);

            $category = $categories->get($categorySlug);

            Product::query()->firstOrCreate(
                ['slug' => $product['slug']],
                [
                    ...$product,
                    'shop_id' => $shop->id,
                    'category_id' => $category->id,
                    'thumbnail_disk' => 'public',
                    'status' => ProductStatus::Active,
                    'published_at' => now()->subDay(),
                ],
            );
        }
    }
}
