<?php

namespace Tests\Feature\Customer;

use App\Enums\CategoryStatus;
use App\Enums\ProductStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Support\CreatesPublicShopCatalogue;
use Tests\TestCase;

class CustomerShopSearchTest extends TestCase
{
    use CreatesPublicShopCatalogue, RefreshDatabase;

    public function test_shop_name_search_ranks_unique_public_summaries_and_keeps_private_state_separate(): void
    {
        $category = $this->shopCategory();
        $exact = $this->shop($category, ['name' => 'Canvas', 'slug' => 'exact', 'created_at' => now()->subDays(3)]);
        $prefix = $this->shop($category, ['name' => 'Canvas Goods', 'slug' => 'prefix', 'created_at' => now()->subDays(2)]);
        $contains = $this->shop($category, ['name' => 'The Canvas Shop', 'slug' => 'contains']);
        $this->shop($category, ['name' => 'Other', 'description' => 'Canvas is not a name match']);
        $productCategory = $this->productCategory($category, 'Canvas');
        $this->product($prefix, $productCategory);
        $this->product($prefix, $productCategory);
        $response = $this->getJson('/api/v1/customer/search/shops?q=%20CaNvAs%20&limit=8')->assertOk()
            ->assertHeader('Cache-Control', 'max-age=60, public')
            ->assertJsonPath('query', 'CaNvAs')->assertJsonPath('pagination.total', 3)->assertJsonPath('pagination.perPage', 8)
            ->assertJsonPath('items.0.id', $exact->id)->assertJsonPath('items.1.id', $prefix->id)->assertJsonPath('items.2.id', $contains->id);
        $this->assertSame(['id', 'slug', 'name', 'description', 'logoUrl', 'bannerUrl', 'category'], array_keys($response->json('items.0')));
        foreach (['Accept', 'Authorization', 'Cookie'] as $header) {
            $this->assertContains($header, explode(', ', $response->headers->get('Vary')));
        }
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $this->actingAs($customer)->getJson('/api/v1/customer/search/shops?q=%20CaNvAs%20&limit=8')
            ->assertOk()->assertExactJson($response->json());
        foreach ([$exact->seller_id, $exact->seller->email, 'contact_email', 'seller_id', 'password', 'storage_path'] as $private) {
            $this->assertStringNotContainsString($private, $response->getContent());
        }
        $this->getJson('/api/v1/customer/search/shops?q=Canvas&page=10000&limit=8')->assertOk()->assertJsonCount(0, 'items')->assertJsonPath('pagination.total', 3);
        $this->getJson('/api/v1/customer/search/shops?q=absent')->assertOk()->assertJsonCount(0, 'items');
        $this->assertDatabaseCount('recently_viewed_products', 0);
        $this->assertDatabaseCount('wishlist_items', 0);
    }

    public function test_shop_search_visibility_does_not_require_public_products_and_inactive_categories_are_null(): void
    {
        $category = $this->shopCategory();
        $empty = $this->shop($category, ['name' => 'Public Empty']);
        $restricted = $this->shop($category, ['name' => 'Public Restricted']);
        $product = $this->product($restricted, $this->productCategory($category, 'Goods'));
        $this->restrict($product, $restricted->seller);
        $this->shop($category, ['name' => 'Public Suspended', 'status' => ShopStatus::Suspended]);
        $this->shop($category, ['name' => 'Public Vacation', 'is_on_vacation' => true]);
        $this->shop($category, ['name' => 'Public Inactive Seller'], UserStatus::Suspended);
        $this->shop($category, ['name' => 'Public Wrong Role'], UserStatus::Active, UserRole::Customer);
        $category->update(['status' => CategoryStatus::Archived]);
        $response = $this->getJson('/api/v1/customer/search/shops?q=Public')->assertOk()->assertJsonCount(2, 'items');
        $this->assertEqualsCanonicalizing([$empty->id, $restricted->id], array_column($response->json('items'), 'id'));
        $response->assertJsonPath('items.0.category', null)->assertJsonPath('items.1.category', null);
    }

    public function test_keyword_and_category_intersect_with_owned_visible_products_and_stable_options(): void
    {
        $shopCategory = $this->shopCategory();
        $shop = $this->shop($shopCategory, ['slug' => 'owned']);
        $other = $this->shop($shopCategory);
        $clothing = $this->productCategory($shopCategory, 'Clothing', 1);
        $accessories = $this->productCategory($shopCategory, 'Accessories', 2);
        $foreignCategory = $this->productCategory($shopCategory, 'Foreign', 3);
        $olderExact = $this->product($shop, $clothing, ['name' => 'Shirt', 'published_at' => now()->subDays(2)]);
        $newer = $this->product($shop, $clothing, ['name' => 'Canvas Shirt', 'stock_quantity' => 0, 'published_at' => now()->subDay()]);
        $this->product($shop, $accessories, ['name' => 'Shirt pin']);
        $this->product($shop, $clothing, ['name' => 'Draft Shirt', 'status' => ProductStatus::Draft]);
        $this->product($shop, $clothing, ['name' => 'Future Shirt', 'published_at' => now()->addDay()]);
        $this->product($shop, $clothing, ['name' => 'Archived Shirt', 'status' => ProductStatus::Archived]);
        $restricted = $this->product($shop, $clothing, ['name' => 'Restricted Shirt']);
        $this->restrict($restricted, $shop->seller);
        $this->product($other, $foreignCategory, ['name' => 'Foreign Shirt']);
        $response = $this->getJson('/api/v1/customer/shops/owned/products?q=%20sHiRt%20&category=clothing')
            ->assertOk()->assertJsonPath('pagination.total', 2)->assertJsonCount(2, 'categories')
            ->assertJsonPath('items.0.id', $newer->id)->assertJsonPath('items.1.id', $olderExact->id)
            ->assertJsonPath('items.0.stockStatus', 'out_of_stock');
        $this->assertIsNumeric($response->json('items.0.price'));
        $none = $this->getJson('/api/v1/customer/shops/owned/products?q=not-matched&category=clothing')
            ->assertOk()->assertJsonPath('pagination.total', 0)->assertJsonCount(0, 'items');
        $this->assertSame($response->json('categories'), $none->json('categories'));
        $this->getJson('/api/v1/customer/shops/owned/products?q=shirt&category=foreign')->assertUnprocessable();
        $this->getJson('/api/v1/customer/shops/owned/products?q=Clothing')->assertOk()->assertJsonCount(0, 'items');
        $this->getJson('/api/v1/customer/shops/owned/products?q=owned')->assertOk()->assertJsonCount(0, 'items');
        $this->assertSame(0, $newer->fresh()->stock_quantity);
        $this->assertDatabaseCount('recently_viewed_products', 0);
        $this->assertDatabaseCount('wishlist_items', 0);
    }

    public function test_literal_wildcards_and_blank_shop_keyword_do_not_widen_scope(): void
    {
        $shopCategory = $this->shopCategory();
        $shop = $this->shop($shopCategory, ['slug' => 'literal', 'name' => '100%_! Shop']);
        $other = $this->shop($shopCategory, ['name' => 'Regular Shop']);
        $category = $this->productCategory($shopCategory, 'Goods');
        $literal = $this->product($shop, $category, ['name' => '100%_! cotton']);
        $this->product($shop, $category, ['name' => 'Regular cotton', 'description_markdown' => 'Needle description']);
        $this->product($other, $category, ['name' => '100%_! foreign']);
        foreach (['%', '_', '!', '100%_!', "' OR 1=1 --"] as $query) {
            $encoded = rawurlencode($query);
            $response = $this->getJson('/api/v1/customer/search/shops?q='.$encoded)->assertOk();
            $browse = $this->getJson('/api/v1/customer/shops/literal/products?q='.$encoded)->assertOk();
            if ($query === "' OR 1=1 --") {
                $response->assertJsonCount(0, 'items');
                $browse->assertJsonCount(0, 'items');
            } else {
                $response->assertJsonCount(1, 'items')->assertJsonPath('items.0.id', $shop->id);
                $browse->assertJsonCount(1, 'items')->assertJsonPath('items.0.id', $literal->id);
            }
        }
        $blank = $this->getJson('/api/v1/customer/shops/literal/products?q=%20%20')->assertOk()->json();
        $this->assertSame($this->getJson('/api/v1/customer/shops/literal/products')->assertOk()->json(), $blank);
        $this->getJson('/api/v1/customer/shops/literal/products?q=Needle')->assertOk()->assertJsonCount(0, 'items');
    }

    public function test_malformed_repeated_unsupported_and_oversized_inputs_are_validation_errors(): void
    {
        $shop = $this->shop($this->shopCategory(), ['slug' => 'validated']);
        $tooLong = str_repeat('x', 101);
        foreach (['q[]=x', 'q=a&q=b', 'q=a&%71=b', 'q='.$tooLong, 'q=x&page=0', 'q=x&page[]=1', 'q=x&limit=51', 'q=x&page=1&page=2'] as $query) {
            $this->getJson('/api/v1/customer/search/shops?'.$query)->assertUnprocessable();
            $this->getJson('/api/v1/customer/products/search?'.$query)->assertUnprocessable();
            $this->getJson('/api/v1/customer/shops/validated/products?'.$query)->assertUnprocessable();
        }
        foreach (['q=x&seller_id='.$shop->seller_id, 'q=x&sort=newest', 'search=x', 'q=x&category[]=goods', 'q=x&category=a&category=b'] as $query) {
            $this->getJson('/api/v1/customer/search/shops?'.$query)->assertUnprocessable();
            $this->getJson('/api/v1/customer/shops/validated/products?'.$query)->assertUnprocessable();
        }
        foreach (['', 'q=', 'q=%20%20'] as $query) {
            $this->getJson('/api/v1/customer/search/shops?'.$query)->assertUnprocessable();
        }
    }

    public function test_shop_search_and_filtered_products_keep_query_counts_bounded_and_pagination_stable(): void
    {
        $category = $this->shopCategory();
        $shop = $this->shop($category, ['name' => 'Bounded Goods', 'slug' => 'bounded']);
        $productCategory = $this->productCategory($category, 'Goods');
        $this->product($shop, $productCategory, ['name' => 'Bounded Product']);
        DB::enableQueryLog();
        $this->getJson('/api/v1/customer/search/shops?q=Bounded&limit=8')->assertOk();
        $shopCount = count(DB::getQueryLog());
        DB::flushQueryLog();
        $this->getJson('/api/v1/customer/shops/bounded/products?q=Bounded&limit=8')->assertOk();
        $productCount = count(DB::getQueryLog());
        foreach (range(1, 8) as $index) {
            $this->shop($category, ['name' => 'Bounded '.$index, 'created_at' => now()->subDays(2)]);
            $this->product($shop, $productCategory, ['name' => 'Bounded Product '.$index, 'published_at' => now()->subDay()]);
        }
        DB::flushQueryLog();
        $first = $this->getJson('/api/v1/customer/search/shops?q=Bounded&limit=8')->assertOk()->assertJsonCount(8, 'items');
        $this->assertSame($shopCount, count(DB::getQueryLog()));
        $second = $this->getJson('/api/v1/customer/search/shops?q=Bounded&limit=8&page=2')->assertOk()->assertJsonCount(1, 'items');
        $this->assertEmpty(array_intersect(array_column($first->json('items'), 'id'), array_column($second->json('items'), 'id')));
        DB::flushQueryLog();
        $this->getJson('/api/v1/customer/shops/bounded/products?q=Bounded&limit=8')->assertOk()->assertJsonCount(8, 'items');
        $this->assertSame($productCount, count(DB::getQueryLog()));
    }
}
