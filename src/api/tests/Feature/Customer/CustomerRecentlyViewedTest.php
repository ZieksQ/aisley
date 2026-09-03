<?php

namespace Tests\Feature\Customer;

use App\Enums\CategoryStatus;
use App\Enums\ProductStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Category;
use App\Models\Product;
use App\Models\RecentlyViewedProduct;
use App\Models\Shop;
use App\Models\ShopCategory;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class CustomerRecentlyViewedTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_only_an_active_customer_can_record_a_visible_product(): void
    {
        [$shop, $category] = $this->catalog();
        $visible = $this->product($shop, $category, ['slug' => 'visible-product']);
        $draft = $this->product($shop, $category, ['slug' => 'draft-product', 'status' => ProductStatus::Draft]);
        $customer = $this->customer();

        $this->putJson("/api/v1/customer/recently-viewed/{$visible->id}")->assertUnauthorized();

        $seller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
        $this->actingAs($seller)->putJson("/api/v1/customer/recently-viewed/{$visible->id}")
            ->assertForbidden()->assertJsonPath('code', 'FORBIDDEN_ROLE');

        $pending = $this->customer(UserStatus::Pending);
        $this->actingAs($pending)->putJson("/api/v1/customer/recently-viewed/{$visible->id}")
            ->assertForbidden()->assertJsonPath('code', 'ACCOUNT_PENDING_APPROVAL');

        $this->actingAs($customer)->putJson("/api/v1/customer/recently-viewed/{$draft->id}")
            ->assertNotFound();
        $this->putJson('/api/v1/customer/recently-viewed/'.Str::uuid())
            ->assertNotFound();

        $this->putJson("/api/v1/customer/recently-viewed/{$visible->id}")
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.productId', $visible->id);

        $this->assertDatabaseHas('recently_viewed_products', [
            'user_id' => $customer->id,
            'product_id' => $visible->id,
        ]);
    }

    public function test_repeated_records_update_recency_and_prune_the_oldest_customer_rows(): void
    {
        config(['recently-viewed.retention_limit' => 3]);
        [$shop, $category] = $this->catalog();
        $products = collect(range(1, 4))->map(fn (int $position) => $this->product(
            $shop,
            $category,
            ['slug' => "retention-product-{$position}"],
        ));
        $customer = $this->customer();
        $this->actingAs($customer);

        foreach ($products as $position => $product) {
            CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-09-03T08:00:00Z')->addMinutes($position));
            $this->putJson("/api/v1/customer/recently-viewed/{$product->id}")->assertOk();
        }

        $this->assertDatabaseCount('recently_viewed_products', 3);
        $this->assertDatabaseMissing('recently_viewed_products', [
            'user_id' => $customer->id,
            'product_id' => $products[0]->id,
        ]);

        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-09-03T09:00:00Z'));
        $this->putJson("/api/v1/customer/recently-viewed/{$products[1]->id}")->assertOk();

        $this->assertDatabaseCount('recently_viewed_products', 3);
        $this->assertSame(
            $products[1]->id,
            RecentlyViewedProduct::query()->orderByDesc('last_viewed_at')->firstOrFail()->product_id,
        );
    }

    public function test_guest_merge_is_validated_visibility_filtered_idempotent_and_keeps_later_recency(): void
    {
        [$shop, $category] = $this->catalog();
        $first = $this->product($shop, $category, ['slug' => 'merge-first']);
        $second = $this->product($shop, $category, ['slug' => 'merge-second']);
        $hidden = $this->product($shop, $category, ['slug' => 'merge-hidden', 'status' => ProductStatus::Draft]);
        $customer = $this->customer();
        $this->actingAs($customer);

        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-09-03T12:00:00Z'));
        $this->putJson("/api/v1/customer/recently-viewed/{$first->id}")->assertOk();

        $payload = ['items' => [
            ['productId' => $second->id, 'viewedAt' => '2026-09-03T11:30:00Z'],
            ['productId' => $first->id, 'viewedAt' => '2026-09-03T10:00:00Z'],
            ['productId' => $hidden->id, 'viewedAt' => '2026-09-03T11:00:00Z'],
        ]];

        $this->postJson('/api/v1/customer/recently-viewed/merge', $payload)
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.mergedProductIds', [$second->id, $first->id])
            ->assertJsonPath('data.mergedCount', 2);
        $this->postJson('/api/v1/customer/recently-viewed/merge', $payload)
            ->assertOk()->assertJsonPath('data.mergedCount', 2);

        $this->assertDatabaseCount('recently_viewed_products', 2);
        $this->assertDatabaseMissing('recently_viewed_products', ['product_id' => $hidden->id]);
        $this->assertSame(
            '2026-09-03 12:00:00',
            RecentlyViewedProduct::query()->where('product_id', $first->id)->firstOrFail()->last_viewed_at->utc()->format('Y-m-d H:i:s'),
        );

        $this->postJson('/api/v1/customer/recently-viewed/merge', ['items' => [
            ['productId' => $first->id, 'viewedAt' => '2026-09-03T10:00:00Z'],
            ['productId' => $first->id, 'viewedAt' => '2026-09-03T11:00:00Z'],
        ]])->assertUnprocessable()->assertJsonValidationErrors('items.1.productId');
        $this->postJson('/api/v1/customer/recently-viewed/merge', ['items' => [
            ['productId' => 'not-a-uuid', 'viewedAt' => '2026-09-03T10:00:00Z'],
        ]])->assertUnprocessable()->assertJsonValidationErrors('items.0.productId');
        $this->postJson('/api/v1/customer/recently-viewed/merge', ['items' => [
            ['productId' => $first->id, 'viewedAt' => '2026-09-04T10:00:00Z'],
        ]])->assertUnprocessable()->assertJsonValidationErrors('items.0.viewedAt');
        $this->postJson('/api/v1/customer/recently-viewed/merge', [
            'items' => [['productId' => $first->id]],
            'userId' => $customer->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('userId');
    }

    public function test_history_is_customer_scoped_cursor_paginated_safe_and_removable(): void
    {
        [$shop, $category] = $this->catalog();
        $products = collect(range(1, 3))->map(fn (int $position) => $this->product(
            $shop,
            $category,
            ['slug' => "history-product-{$position}"],
        ));
        $customer = $this->customer();
        $other = $this->customer();

        foreach ($products as $position => $product) {
            RecentlyViewedProduct::create([
                'user_id' => $customer->id,
                'product_id' => $product->id,
                'last_viewed_at' => now()->subMinutes($position),
            ]);
        }
        RecentlyViewedProduct::create([
            'user_id' => $other->id,
            'product_id' => $products[0]->id,
            'last_viewed_at' => now()->addMinute(),
        ]);

        $this->actingAs($customer);
        $firstPage = $this->getJson('/api/v1/customer/recently-viewed?limit=2')
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.product.id', $products[0]->id)
            ->assertJsonMissingPath('data.0.product.shop.contact_email')
            ->assertJsonMissingPath('data.0.user_id');
        $cursor = $firstPage->json('meta.next_cursor');
        $this->assertIsString($cursor);

        $this->getJson('/api/v1/customer/recently-viewed?limit=2&cursor='.urlencode($cursor))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.product.id', $products[2]->id);
        $this->getJson('/api/v1/customer/recently-viewed?cursor=invalid')
            ->assertUnprocessable()->assertJsonValidationErrors('cursor');
        $this->getJson('/api/v1/customer/recently-viewed?sort=oldest')
            ->assertUnprocessable()->assertJsonValidationErrors('sort');

        $this->deleteJson("/api/v1/customer/recently-viewed/{$products[0]->id}")
            ->assertOk()->assertJsonPath('data.removed', true);
        $this->deleteJson("/api/v1/customer/recently-viewed/{$products[0]->id}")
            ->assertOk()->assertJsonPath('data.removed', false);
        $this->assertDatabaseHas('recently_viewed_products', [
            'user_id' => $other->id,
            'product_id' => $products[0]->id,
        ]);

        $this->deleteJson('/api/v1/customer/recently-viewed')
            ->assertOk()->assertJsonPath('data.removedCount', 2);
        $this->assertDatabaseMissing('recently_viewed_products', ['user_id' => $customer->id]);
        $this->assertDatabaseHas('recently_viewed_products', ['user_id' => $other->id]);
    }

    public function test_public_resolver_preserves_requested_order_and_omits_unavailable_products(): void
    {
        [$shop, $category] = $this->catalog();
        $first = $this->product($shop, $category, ['slug' => 'resolver-first']);
        $second = $this->product($shop, $category, ['slug' => 'resolver-second']);
        $hidden = $this->product($shop, $category, ['slug' => 'resolver-hidden', 'status' => ProductStatus::Archived]);

        $this->postJson('/api/v1/customer/products/resolve', [
            'productIds' => [$second->id, $hidden->id, $first->id],
        ])->assertOk()
            ->assertHeader('Cache-Control', 'max-age=60, public')
            ->assertJsonCount(2, 'items')
            ->assertJsonPath('items.0.id', $second->id)
            ->assertJsonPath('items.1.id', $first->id)
            ->assertJsonMissing(['id' => $hidden->id]);

        $this->postJson('/api/v1/customer/products/resolve', [
            'productIds' => array_map(fn () => (string) Str::uuid(), range(1, 13)),
        ])->assertUnprocessable()->assertJsonValidationErrors('productIds');
        $this->postJson('/api/v1/customer/products/resolve', [
            'productIds' => [$first->id, $first->id],
        ])->assertUnprocessable()->assertJsonValidationErrors('productIds.1');
        $this->postJson('/api/v1/customer/products/resolve', [
            'productIds' => [$first->id],
            'include' => 'seller',
        ])->assertUnprocessable()->assertJsonValidationErrors('include');
    }

    public function test_history_list_query_count_does_not_grow_with_page_size(): void
    {
        [$shop, $category] = $this->catalog();
        $customer = $this->customer();
        $this->createView($customer, $this->product($shop, $category));
        $this->actingAs($customer);

        DB::enableQueryLog();
        $this->getJson('/api/v1/customer/recently-viewed?limit=10')->assertOk();
        $singleQueryCount = count(DB::getQueryLog());

        foreach (range(1, 7) as $position) {
            $this->createView($customer, $this->product($shop, $category, ['slug' => "query-product-{$position}"]));
        }

        DB::flushQueryLog();
        $this->getJson('/api/v1/customer/recently-viewed?limit=10')
            ->assertOk()->assertJsonCount(8, 'data');
        $this->assertSame($singleQueryCount, count(DB::getQueryLog()));
    }

    /** @return array{Shop, Category} */
    private function catalog(): array
    {
        $shopCategory = ShopCategory::create([
            'name' => 'General '.Str::random(5),
            'slug' => 'general-'.Str::lower(Str::random(8)),
            'status' => CategoryStatus::Active,
        ]);
        $seller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
        $shop = Shop::create([
            'seller_id' => $seller->id,
            'shop_category_id' => $shopCategory->id,
            'name' => 'History Shop',
            'slug' => 'history-shop-'.Str::lower(Str::random(8)),
            'status' => ShopStatus::Active,
            'is_on_vacation' => false,
        ]);
        $category = Category::create([
            'shop_category_id' => $shopCategory->id,
            'name' => 'History Products',
            'slug' => 'history-products-'.Str::lower(Str::random(8)),
            'status' => CategoryStatus::Active,
        ]);

        return [$shop, $category];
    }

    private function customer(UserStatus $status = UserStatus::Active): User
    {
        return User::factory()->create(['role' => UserRole::Customer, 'status' => $status]);
    }

    private function product(Shop $shop, Category $category, array $overrides = []): Product
    {
        return Product::create(array_merge([
            'shop_id' => $shop->id,
            'category_id' => $category->id,
            'name' => 'Viewed Product '.Str::random(5),
            'slug' => 'viewed-product-'.Str::lower(Str::random(8)),
            'price' => 100,
            'stock_quantity' => 10,
            'review_count' => 0,
            'sold_count' => 0,
            'badges' => [],
            'status' => ProductStatus::Active,
            'published_at' => now()->subDay(),
        ], $overrides));
    }

    private function createView(User $customer, Product $product): RecentlyViewedProduct
    {
        return RecentlyViewedProduct::create([
            'user_id' => $customer->id,
            'product_id' => $product->id,
            'last_viewed_at' => now(),
        ]);
    }
}
