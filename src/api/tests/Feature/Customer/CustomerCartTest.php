<?php

namespace Tests\Feature\Customer;

use App\Enums\ProductStatus;
use App\Enums\ProductVariantStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Database\Seeders\ProductSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerCartTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(ProductSeeder::class);
    }

    public function test_cart_endpoints_require_an_active_customer(): void
    {
        $this->getJson('/api/v1/customer/cart')->assertUnauthorized();

        $seller = User::factory()->create(['role' => UserRole::Seller]);
        Sanctum::actingAs($seller);
        $this->getJson('/api/v1/customer/cart')
            ->assertForbidden()
            ->assertJsonPath('code', 'FORBIDDEN_ROLE');

        $pending = User::factory()->create(['status' => UserStatus::Pending]);
        Sanctum::actingAs($pending);
        $this->getJson('/api/v1/customer/cart')
            ->assertForbidden()
            ->assertJsonPath('code', 'ACCOUNT_PENDING_APPROVAL');
    }

    public function test_customer_can_read_an_empty_cart_and_add_a_simple_product(): void
    {
        $customer = $this->customer();
        $camera = Product::query()->where('slug', 'compact-everyday-camera')->firstOrFail();

        $this->getJson('/api/v1/customer/cart')
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.itemCount', 0)
            ->assertJsonPath('data.distinctItemCount', 0)
            ->assertJsonPath('data.subtotal', 0)
            ->assertJsonPath('data.items', []);

        $response = $this->postJson('/api/v1/customer/cart/items', [
            'product_id' => $camera->id,
            'variant_id' => null,
            'quantity' => 2,
            'price' => 1,
            'customer_id' => User::factory()->create()->id,
        ])->assertOk()
            ->assertJsonPath('data.itemCount', 2)
            ->assertJsonPath('data.distinctItemCount', 1)
            ->assertJsonPath('data.subtotal', 13500)
            ->assertJsonPath('data.items.0.product.id', $camera->id)
            ->assertJsonPath('data.items.0.unitPrice', 6750)
            ->assertJsonPath('data.items.0.lineSubtotal', 13500)
            ->assertJsonPath('data.items.0.variant', null)
            ->assertJsonPath('data.items.0.selectedOptions', [])
            ->assertJsonPath('data.items.0.availability.isAvailable', true)
            ->assertJsonPath('data.items.0.availability.availableQuantity', 14);

        $this->assertDatabaseHas('carts', ['customer_id' => $customer->id]);
        $this->assertDatabaseHas('cart_items', [
            'product_id' => $camera->id,
            'variant_id' => null,
            'quantity' => 2,
        ]);
        $this->assertSame($customer->cart->id, $response->json('data.id'));
    }

    public function test_same_configuration_merges_and_different_variants_remain_distinct(): void
    {
        $this->customer();
        $product = Product::query()->where('slug', 'city-runner-sneakers')->firstOrFail();
        $red40 = ProductVariant::query()->where('sku', 'CRS-RED-40')->firstOrFail();
        $white40 = ProductVariant::query()->where('sku', 'CRS-WHT-40')->firstOrFail();

        $this->add($product, $red40, 2)->assertOk();
        $this->add($product, $red40, 3)
            ->assertOk()
            ->assertJsonPath('data.itemCount', 5)
            ->assertJsonPath('data.distinctItemCount', 1);
        $this->add($product, $white40, 1)
            ->assertOk()
            ->assertJsonPath('data.itemCount', 6)
            ->assertJsonPath('data.distinctItemCount', 2);

        $this->assertDatabaseCount('cart_items', 2);
        $this->assertDatabaseHas('cart_items', ['variant_id' => $red40->id, 'quantity' => 5]);
        $this->assertDatabaseHas('cart_items', ['variant_id' => $white40->id, 'quantity' => 1]);
    }

    public function test_variant_cart_projection_uses_current_price_ordered_choices_and_variant_media(): void
    {
        $this->customer();
        $product = Product::query()->where('slug', 'city-runner-sneakers')->firstOrFail();
        $variant = ProductVariant::query()->where('sku', 'CRS-WHT-41')->firstOrFail();

        $payload = $this->add($product, $variant, 2)
            ->assertOk()
            ->assertJsonPath('data.items.0.unitPrice', 2990)
            ->assertJsonPath('data.items.0.lineSubtotal', 5980)
            ->assertJsonPath('data.items.0.variant.sku', 'CRS-WHT-41')
            ->assertJsonPath('data.items.0.selectedOptions.0.group', 'Color')
            ->assertJsonPath('data.items.0.selectedOptions.0.value', 'White')
            ->assertJsonPath('data.items.0.selectedOptions.1.group', 'Size')
            ->assertJsonPath('data.items.0.selectedOptions.1.value', '41')
            ->json('data.items.0');

        $this->assertStringContainsString('unsplash.com', $payload['media']['url']);
        $encoded = json_encode($payload, JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString('seller_id', $encoded);
        $this->assertStringNotContainsString('stock_quantity', $encoded);
        $this->assertStringNotContainsString('thumbnail_path', $encoded);
        $this->assertStringNotContainsString('status', $encoded);
    }

    public function test_add_rejects_missing_mismatched_inactive_malformed_and_unexpected_variants(): void
    {
        $this->customer();
        $sneakers = Product::query()->where('slug', 'city-runner-sneakers')->firstOrFail();
        $camera = Product::query()->where('slug', 'compact-everyday-camera')->firstOrFail();
        $headphonesVariant = ProductVariant::query()->where('sku', 'AWH-BLK')->firstOrFail();
        $red40 = ProductVariant::query()->where('sku', 'CRS-RED-40')->firstOrFail();

        $this->postJson('/api/v1/customer/cart/items', [
            'product_id' => $sneakers->id,
            'variant_id' => null,
            'quantity' => 1,
        ])->assertUnprocessable()->assertJsonPath('code', 'VARIANT_REQUIRED');

        $this->add($sneakers, $headphonesVariant, 1)
            ->assertUnprocessable()
            ->assertJsonPath('code', 'INVALID_VARIANT');

        $this->add($camera, $red40, 1)
            ->assertUnprocessable()
            ->assertJsonPath('code', 'VARIANT_NOT_ALLOWED');

        $red40->update(['status' => ProductVariantStatus::Inactive]);
        $this->add($sneakers, $red40, 1)
            ->assertConflict()
            ->assertJsonPath('code', 'VARIANT_UNAVAILABLE');

        $red40->update(['status' => ProductVariantStatus::Active]);
        $red40->optionValues()->detach($red40->optionValues()->firstOrFail()->id);
        $this->add($sneakers, $red40, 1)
            ->assertUnprocessable()
            ->assertJsonPath('code', 'INVALID_VARIANT_COMBINATION');

        $this->assertDatabaseCount('cart_items', 0);
    }

    public function test_add_rejects_stock_and_product_availability_conflicts_without_mutating_cart(): void
    {
        $this->customer();
        $sneakers = Product::query()->where('slug', 'city-runner-sneakers')->firstOrFail();
        $outOfStock = ProductVariant::query()->where('sku', 'CRS-RED-41')->firstOrFail();
        $inStock = ProductVariant::query()->where('sku', 'CRS-RED-40')->firstOrFail();

        $this->add($sneakers, $outOfStock, 1)
            ->assertConflict()
            ->assertJsonPath('code', 'OUT_OF_STOCK');
        $this->add($sneakers, $inStock, 11)
            ->assertConflict()
            ->assertJsonPath('code', 'INSUFFICIENT_STOCK');

        $sneakers->update(['status' => ProductStatus::Draft]);
        $this->add($sneakers, $inStock, 1)
            ->assertConflict()
            ->assertJsonPath('code', 'PRODUCT_UNAVAILABLE');

        $this->assertDatabaseCount('cart_items', 0);
    }

    public function test_customer_can_update_quantity_change_variation_and_merge_atomically(): void
    {
        $this->customer();
        $product = Product::query()->where('slug', 'city-runner-sneakers')->firstOrFail();
        $white40 = ProductVariant::query()->where('sku', 'CRS-WHT-40')->firstOrFail();
        $white41 = ProductVariant::query()->where('sku', 'CRS-WHT-41')->firstOrFail();
        $outOfStock = ProductVariant::query()->where('sku', 'CRS-RED-41')->firstOrFail();

        $firstItemId = $this->add($product, $white40, 1)->json('data.items.0.id');
        $this->patchJson('/api/v1/customer/cart/items/'.$firstItemId, ['quantity' => 2])
            ->assertOk()
            ->assertJsonPath('data.items.0.quantity', 2);

        $this->patchJson('/api/v1/customer/cart/items/'.$firstItemId, [
            'variant_id' => $outOfStock->id,
        ])->assertConflict()->assertJsonPath('code', 'OUT_OF_STOCK');
        $this->assertDatabaseHas('cart_items', [
            'id' => $firstItemId,
            'variant_id' => $white40->id,
            'quantity' => 2,
        ]);

        $this->add($product, $white41, 1)->assertOk();
        $this->patchJson('/api/v1/customer/cart/items/'.$firstItemId, [
            'variant_id' => $white41->id,
        ])->assertOk()
            ->assertJsonPath('data.itemCount', 3)
            ->assertJsonPath('data.distinctItemCount', 1)
            ->assertJsonPath('data.items.0.variant.id', $white41->id)
            ->assertJsonPath('data.items.0.quantity', 3);

        $this->assertDatabaseMissing('cart_items', ['id' => $firstItemId]);
        $this->assertDatabaseHas('cart_items', ['variant_id' => $white41->id, 'quantity' => 3]);
    }

    public function test_customer_cannot_mutate_another_customers_item_and_can_delete_own_item(): void
    {
        $firstCustomer = $this->customer();
        $product = Product::query()->where('slug', 'compact-everyday-camera')->firstOrFail();
        $itemId = $this->postJson('/api/v1/customer/cart/items', [
            'product_id' => $product->id,
            'variant_id' => null,
            'quantity' => 1,
        ])->json('data.items.0.id');

        $secondCustomer = User::factory()->create();
        Sanctum::actingAs($secondCustomer);
        $this->patchJson('/api/v1/customer/cart/items/'.$itemId, ['quantity' => 2])->assertNotFound();
        $this->deleteJson('/api/v1/customer/cart/items/'.$itemId)->assertNotFound();
        $this->assertDatabaseHas('cart_items', ['id' => $itemId, 'quantity' => 1]);

        Sanctum::actingAs($firstCustomer);
        $this->deleteJson('/api/v1/customer/cart/items/'.$itemId)
            ->assertOk()
            ->assertJsonPath('data.itemCount', 0)
            ->assertJsonPath('data.items', []);
        $this->assertDatabaseMissing('cart_items', ['id' => $itemId]);
    }

    public function test_cart_read_keeps_customer_intent_and_marks_lines_unavailable_from_current_state(): void
    {
        $this->customer();
        $product = Product::query()->where('slug', 'city-runner-sneakers')->firstOrFail();
        $variant = ProductVariant::query()->where('sku', 'CRS-WHT-40')->firstOrFail();

        $itemId = $this->add($product, $variant, 2)->json('data.items.0.id');
        $variant->update(['stock_quantity' => 1]);

        $this->getJson('/api/v1/customer/cart')
            ->assertOk()
            ->assertJsonPath('data.items.0.id', $itemId)
            ->assertJsonPath('data.items.0.availability.isAvailable', false)
            ->assertJsonPath('data.items.0.availability.reason', 'insufficient_stock')
            ->assertJsonPath('data.items.0.availability.availableQuantity', 1)
            ->assertJsonPath('data.availableSubtotal', 0);

        $this->assertDatabaseHas('cart_items', ['id' => $itemId, 'quantity' => 2]);
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

    private function add(Product $product, ProductVariant $variant, int $quantity)
    {
        return $this->postJson('/api/v1/customer/cart/items', [
            'product_id' => $product->id,
            'variant_id' => $variant->id,
            'quantity' => $quantity,
        ]);
    }
}
