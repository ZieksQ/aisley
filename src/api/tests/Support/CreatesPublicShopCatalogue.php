<?php

namespace Tests\Support;

use App\Enums\CategoryStatus;
use App\Enums\ProductStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductComplianceRestriction;
use App\Models\SellerComplianceCase;
use App\Models\Shop;
use App\Models\ShopCategory;
use App\Models\User;
use Illuminate\Support\Str;

trait CreatesPublicShopCatalogue
{
    private function shopCategory(string $name = 'General', int $position = 0): ShopCategory
    {
        return ShopCategory::create([
            'name' => $name,
            'slug' => Str::slug($name),
            'status' => CategoryStatus::Active,
            'position' => $position,
        ]);
    }

    private function shop(
        ShopCategory $category,
        array $overrides = [],
        UserStatus $sellerStatus = UserStatus::Active,
        UserRole $sellerRole = UserRole::Seller,
    ): Shop {
        $seller = User::factory()->create(['role' => $sellerRole, 'status' => $sellerStatus]);

        return Shop::create(array_merge([
            'seller_id' => $seller->id,
            'shop_category_id' => $category->id,
            'name' => 'Test Shop '.Str::random(5),
            'slug' => 'shop-'.Str::lower(Str::random(8)),
            'status' => ShopStatus::Active,
            'is_on_vacation' => false,
        ], $overrides));
    }

    private function productCategory(ShopCategory $shopCategory, string $name, int $position = 0): Category
    {
        return Category::create([
            'shop_category_id' => $shopCategory->id,
            'name' => $name,
            'slug' => Str::slug($name),
            'status' => CategoryStatus::Active,
            'position' => $position,
        ]);
    }

    private function product(Shop $shop, Category $category, array $overrides = []): Product
    {
        return Product::create(array_merge([
            'shop_id' => $shop->id,
            'category_id' => $category->id,
            'name' => 'Shop Product '.Str::random(5),
            'slug' => 'product-'.Str::lower(Str::random(8)),
            'price' => 100,
            'stock_quantity' => 10,
            'review_count' => 0,
            'sold_count' => 0,
            'badges' => [],
            'status' => ProductStatus::Active,
            'published_at' => now()->subHours(2),
        ], $overrides));
    }

    private function restrict(Product $product, User $seller): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $case = SellerComplianceCase::create([
            'seller_id' => $seller->id,
            'product_id' => $product->id,
            'source_type' => 'manual_admin_review',
            'reason' => 'Test restriction',
            'status' => 'confirmed',
            'created_by_admin_id' => $admin->id,
        ]);
        ProductComplianceRestriction::create([
            'product_id' => $product->id,
            'case_id' => $case->id,
            'active_marker' => 'active',
            'reason' => 'Test restriction',
            'imposed_by_admin_id' => $admin->id,
            'imposed_at' => now(),
        ]);
    }
}
