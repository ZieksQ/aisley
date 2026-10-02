<?php

namespace Tests\Feature\Customer;

use App\Enums\ProductStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\CreatesPublicShopCatalogue;
use Tests\TestCase;

class CustomerBrowseShopTest extends TestCase
{
    use CreatesPublicShopCatalogue;
    use RefreshDatabase;

    public function test_guests_can_paginate_and_filter_the_public_shop_directory(): void
    {
        $fashion = $this->shopCategory('Fashion', 2);
        $electronics = $this->shopCategory('Electronics', 1);
        $older = $this->shop($fashion, ['name' => 'Older Shop', 'slug' => 'older-shop', 'created_at' => now()->subDay()]);
        $newer = $this->shop($electronics, ['name' => 'Newer Shop', 'slug' => 'newer-shop', 'description' => 'Current releases.']);
        $this->shop($fashion, ['name' => 'Vacation Shop', 'slug' => 'vacation-shop', 'is_on_vacation' => true]);

        $response = $this->getJson('/api/v1/customer/shops?limit=8')
            ->assertOk()
            ->assertHeader('Cache-Control', 'max-age=60, public')
            ->assertJsonCount(2, 'items')
            ->assertJsonPath('items.0.id', $newer->id)
            ->assertJsonPath('items.1.id', $older->id)
            ->assertJsonPath('items.0.category.slug', $electronics->slug)
            ->assertJsonPath('categories.0.slug', $electronics->slug)
            ->assertJsonPath('categories.1.slug', $fashion->slug)
            ->assertJsonPath('pagination.currentPage', 1)
            ->assertJsonPath('pagination.perPage', 8)
            ->assertJsonPath('pagination.total', 2);

        $this->assertSame(
            ['id', 'slug', 'name', 'description', 'logoUrl', 'bannerUrl', 'category'],
            array_keys($response->json('items.0')),
        );

        $this->getJson('/api/v1/customer/shops?shop_category=fashion&limit=8')
            ->assertOk()
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.id', $older->id);
    }

    public function test_missing_and_unavailable_shops_have_the_same_public_not_found_boundary(): void
    {
        $category = $this->shopCategory();
        $inactive = $this->shop($category, ['slug' => 'inactive-shop', 'status' => ShopStatus::Suspended]);
        $vacation = $this->shop($category, ['slug' => 'vacation-shop', 'is_on_vacation' => true, 'vacation_message' => 'Private message']);
        $inactiveSeller = $this->shop($category, ['slug' => 'inactive-seller'], UserStatus::Suspended);
        $wrongRole = $this->shop($category, ['slug' => 'wrong-role'], UserStatus::Active, UserRole::Customer);

        foreach (['missing-shop', $inactive->slug, $vacation->slug, $inactiveSeller->slug, $wrongRole->slug] as $slug) {
            $this->getJson("/api/v1/customer/shops/{$slug}")->assertNotFound();
            $this->getJson("/api/v1/customer/shops/{$slug}/products")->assertNotFound();
        }
    }

    public function test_shop_products_are_visible_shop_scoped_ordered_and_use_canonical_cards(): void
    {
        $shopCategory = $this->shopCategory();
        $shop = $this->shop($shopCategory, [
            'slug' => 'aisley-goods',
            'logo_path' => 'shops/logo.webp',
            'banner_path' => 'shops/banner.webp',
        ]);
        $otherShop = $this->shop($shopCategory, ['slug' => 'other-shop']);
        $firstCategory = $this->productCategory($shopCategory, 'Home', 2);
        $secondCategory = $this->productCategory($shopCategory, 'Electronics', 1);
        $older = $this->product($shop, $firstCategory, ['name' => 'Older Product', 'slug' => 'older-product', 'published_at' => now()->subDay()]);
        $newer = $this->product($shop, $secondCategory, ['name' => 'Newer Product', 'slug' => 'newer-product', 'published_at' => now()->subHour()]);
        $other = $this->product($otherShop, $firstCategory, ['slug' => 'other-product']);

        $this->getJson('/api/v1/customer/shops/aisley-goods')
            ->assertOk()
            ->assertJsonPath('data.id', $shop->id)
            ->assertJsonMissingPath('data.contact_email')
            ->assertJsonMissingPath('data.seller_id');

        $response = $this->getJson('/api/v1/customer/shops/aisley-goods/products?limit=8')
            ->assertOk()
            ->assertJsonPath('shop.id', $shop->id)
            ->assertJsonPath('categories.0.slug', $secondCategory->slug)
            ->assertJsonPath('categories.1.slug', $firstCategory->slug)
            ->assertJsonPath('items.0.id', $newer->id)
            ->assertJsonPath('items.1.id', $older->id)
            ->assertJsonMissing(['id' => $other->id]);

        $this->assertSame([$shop->id], collect($response->json('items'))->pluck('shop.id')->unique()->values()->all());

        $this->getJson('/api/v1/customer/shops/aisley-goods/products?category=home&limit=8')
            ->assertOk()
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.id', $older->id);
    }

    public function test_shop_products_and_categories_exclude_non_visible_records(): void
    {
        $shopCategory = $this->shopCategory();
        $shop = $this->shop($shopCategory, ['slug' => 'visibility-shop']);
        $visibleCategory = $this->productCategory($shopCategory, 'Visible', 1);
        $restrictedCategory = $this->productCategory($shopCategory, 'Restricted', 2);
        $visible = $this->product($shop, $visibleCategory, ['slug' => 'visible-product']);
        $draft = $this->product($shop, $visibleCategory, ['slug' => 'draft-product', 'status' => ProductStatus::Draft]);
        $future = $this->product($shop, $visibleCategory, ['slug' => 'future-product', 'published_at' => now()->addDay()]);
        $restricted = $this->product($shop, $restrictedCategory, ['slug' => 'restricted-product']);
        $this->restrict($restricted, $shop->seller);

        $response = $this->getJson('/api/v1/customer/shops/visibility-shop/products')
            ->assertOk()
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.id', $visible->id)
            ->assertJsonCount(1, 'categories')
            ->assertJsonPath('categories.0.slug', $visibleCategory->slug);

        foreach ([$draft, $future, $restricted] as $hidden) {
            $response->assertJsonMissing(['id' => $hidden->id]);
        }
    }

    public function test_invalid_directory_and_shop_product_parameters_return_validation_errors(): void
    {
        $shopCategory = $this->shopCategory();
        $shop = $this->shop($shopCategory, ['slug' => 'validated-shop']);
        $otherCategory = $this->productCategory($shopCategory, 'Other');
        $this->product($this->shop($shopCategory, ['slug' => 'second-shop']), $otherCategory);

        $this->getJson('/api/v1/customer/shops?shop_category=missing')
            ->assertUnprocessable()->assertJsonValidationErrors('shop_category');
        $this->getJson('/api/v1/customer/shops?limit=7')
            ->assertUnprocessable()->assertJsonValidationErrors('limit');
        $this->getJson('/api/v1/customer/shops?sort=popular')
            ->assertUnprocessable()->assertJsonValidationErrors('sort');
        $this->getJson("/api/v1/customer/shops/{$shop->slug}/products?category={$otherCategory->slug}")
            ->assertUnprocessable()->assertJsonValidationErrors('category');
        $this->getJson("/api/v1/customer/shops/{$shop->slug}/products?search=test")
            ->assertUnprocessable()->assertJsonValidationErrors('search');
    }

    public function test_shop_product_resource_queries_do_not_grow_with_the_page_size(): void
    {
        $shopCategory = $this->shopCategory();
        $shop = $this->shop($shopCategory, ['slug' => 'query-count-shop']);
        $category = $this->productCategory($shopCategory, 'Products');
        $this->product($shop, $category);

        DB::enableQueryLog();
        $this->getJson('/api/v1/customer/shops/query-count-shop/products?limit=8')->assertOk();
        $singleProductQueryCount = count(DB::getQueryLog());

        foreach (range(1, 7) as $position) {
            $this->product($shop, $category, ['slug' => "query-count-product-{$position}"]);
        }

        DB::flushQueryLog();
        $this->getJson('/api/v1/customer/shops/query-count-shop/products?limit=8')
            ->assertOk()
            ->assertJsonCount(8, 'items');

        $this->assertSame($singleProductQueryCount, count(DB::getQueryLog()));
    }
}
