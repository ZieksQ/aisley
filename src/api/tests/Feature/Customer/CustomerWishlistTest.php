<?php

namespace Tests\Feature\Customer;

use App\Enums\ProductStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Product;
use App\Models\User;
use App\Models\WishlistItem;
use Database\Seeders\ProductSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerWishlistTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ProductSeeder::class);
    }

    public function test_wishlist_requires_an_active_customer(): void
    {
        $product = $this->product();
        $this->getJson('/api/v1/customer/wishlist')->assertUnauthorized();

        Sanctum::actingAs(User::factory()->create(['role' => UserRole::Seller]));
        $this->putJson("/api/v1/customer/wishlist/{$product->id}")
            ->assertForbidden()
            ->assertJsonPath('code', 'FORBIDDEN_ROLE');

        Sanctum::actingAs(User::factory()->create([
            'role' => UserRole::Customer,
            'status' => UserStatus::Suspended,
        ]));
        $this->getJson('/api/v1/customer/wishlist')
            ->assertForbidden()
            ->assertJsonPath('code', 'ACCOUNT_SUSPENDED');
    }

    public function test_customer_can_save_and_remove_a_visible_product_idempotently(): void
    {
        $customer = $this->customer();
        $product = $this->product();

        $this->putJson("/api/v1/customer/wishlist/{$product->id}")
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.saved', true)
            ->assertJsonPath('data.productId', $product->id);
        $this->putJson("/api/v1/customer/wishlist/{$product->id}")
            ->assertOk()
            ->assertJsonPath('data.saved', true);

        $this->assertDatabaseCount('wishlist_items', 1);
        $this->assertDatabaseHas('wishlist_items', [
            'user_id' => $customer->id,
            'product_id' => $product->id,
        ]);

        $this->deleteJson("/api/v1/customer/wishlist/{$product->id}")
            ->assertOk()
            ->assertJsonPath('data.saved', false);
        $this->deleteJson("/api/v1/customer/wishlist/{$product->id}")
            ->assertOk()
            ->assertJsonPath('data.saved', false);
        $this->deleteJson('/api/v1/customer/wishlist/'.fake()->uuid())
            ->assertOk()
            ->assertJsonPath('data.saved', false);
        $this->assertDatabaseCount('wishlist_items', 0);
    }

    public function test_mutations_reject_client_owned_fields_and_hidden_products_are_not_saveable(): void
    {
        $this->customer();
        $product = $this->product();

        $this->putJson("/api/v1/customer/wishlist/{$product->id}", [
            'user_id' => User::factory()->create()->id,
            'saved_price' => 1,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['user_id', 'saved_price']);

        $product->update(['status' => ProductStatus::Archived]);
        $this->putJson("/api/v1/customer/wishlist/{$product->id}")->assertNotFound();
        $this->assertDatabaseCount('wishlist_items', 0);
    }

    public function test_list_is_scoped_newest_first_private_and_uses_current_product_projection(): void
    {
        $firstCustomer = $this->customer();
        $first = $this->product('compact-everyday-camera');
        $second = $this->product('studio-wireless-headphones');
        $this->putJson("/api/v1/customer/wishlist/{$first->id}")->assertOk();
        $this->travel(1)->second();
        $this->putJson("/api/v1/customer/wishlist/{$second->id}")->assertOk();

        $otherCustomer = User::factory()->create([
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ]);
        Sanctum::actingAs($otherCustomer);
        $this->putJson("/api/v1/customer/wishlist/{$first->id}")->assertOk();

        Sanctum::actingAs($firstCustomer);
        $payload = $this->getJson('/api/v1/customer/wishlist')
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.product.id', $second->id)
            ->assertJsonPath('data.1.product.id', $first->id)
            ->assertJsonPath('data.0.product.requiresVariantSelection', true)
            ->json();

        $encoded = json_encode($payload, JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString('seller_id', $encoded);
        $this->assertStringNotContainsString('thumbnail_path', $encoded);
        $this->assertStringNotContainsString('user_id', $encoded);
        $this->assertStringNotContainsString($otherCustomer->id, $encoded);
    }

    public function test_hidden_saved_products_are_omitted_and_report_unsaved_by_status(): void
    {
        $this->customer();
        $product = $this->product();
        $this->putJson("/api/v1/customer/wishlist/{$product->id}")->assertOk();

        $product->shop->update(['is_on_vacation' => true]);

        $this->getJson('/api/v1/customer/wishlist')
            ->assertOk()
            ->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/customer/wishlist/status?product_ids[]='.$product->id)
            ->assertOk()
            ->assertJsonPath('data.'.$product->id, false);
        $this->assertDatabaseHas('wishlist_items', ['product_id' => $product->id]);
    }

    public function test_status_is_bounded_distinct_and_returns_only_requested_products(): void
    {
        $this->customer();
        $saved = $this->product('compact-everyday-camera');
        $notSaved = $this->product('studio-wireless-headphones');
        $this->putJson("/api/v1/customer/wishlist/{$saved->id}")->assertOk();

        $this->getJson('/api/v1/customer/wishlist/status?'.http_build_query([
            'product_ids' => [$saved->id, $notSaved->id],
        ]))->assertOk()
            ->assertJsonPath('data.'.$saved->id, true)
            ->assertJsonPath('data.'.$notSaved->id, false)
            ->assertJsonCount(2, 'data');

        $this->getJson('/api/v1/customer/wishlist/status?'.http_build_query([
            'product_ids' => [$saved->id, $saved->id],
        ]))->assertUnprocessable()->assertJsonValidationErrors('product_ids.1');

        $this->getJson('/api/v1/customer/wishlist/status?'.http_build_query([
            'product_ids' => array_fill(0, 51, fake()->uuid()),
        ]))->assertUnprocessable()->assertJsonValidationErrors('product_ids');
    }

    public function test_list_uses_bounded_cursor_pagination(): void
    {
        $customer = $this->customer();
        $shop = $this->product()->shop;

        foreach (range(1, 21) as $number) {
            $product = Product::create([
                'shop_id' => $shop->id,
                'name' => "Wishlist Product {$number}",
                'slug' => "wishlist-product-{$number}",
                'price' => '100.00',
                'stock_quantity' => 5,
                'status' => ProductStatus::Active,
                'published_at' => now(),
            ]);
            WishlistItem::create(['user_id' => $customer->id, 'product_id' => $product->id]);
        }

        $first = $this->getJson('/api/v1/customer/wishlist')
            ->assertOk()
            ->assertJsonCount(20, 'data')
            ->assertJsonPath('meta.per_page', 20);
        $cursor = $first->json('meta.next_cursor');
        $this->assertIsString($cursor);

        $this->getJson('/api/v1/customer/wishlist?'.http_build_query(['cursor' => $cursor]))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.next_cursor', null);
    }

    private function customer(): User
    {
        $customer = User::factory()->create([
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ]);
        Sanctum::actingAs($customer);

        return $customer;
    }

    private function product(string $slug = 'compact-everyday-camera'): Product
    {
        return Product::query()->where('slug', $slug)->with('shop')->firstOrFail();
    }
}
