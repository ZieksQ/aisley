<?php

namespace Tests\Feature\Seller;

use App\Enums\CategoryStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Category;
use App\Models\InventoryMovement;
use App\Models\Shop;
use App\Models\ShopCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SellerProductInventoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_active_seller_can_create_publish_and_adjust_own_product_inventory(): void
    {
        [$seller, $shop, $category] = $this->sellerShop();

        $created = $this->actingAs($seller)->postJson('/api/v1/seller/products', [
            'name' => 'Canvas Backpack',
            'category_id' => $category->id,
            'sku' => 'BAG-001',
            'short_description' => 'Everyday carry.',
            'description_markdown' => '## Details',
            'price' => 899.50,
            'opening_stock' => 10,
        ])->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.skus.0.available', 10);

        $productId = $created->json('data.id');
        $skuId = $created->json('data.skus.0.id');

        $this->postJson("/api/v1/seller/products/{$productId}/publish")
            ->assertOk()->assertJsonPath('data.status', 'active');

        $this->postJson("/api/v1/seller/inventory/{$skuId}/adjustments", [
            'movement_type' => 'manual_decrease',
            'quantity' => 3,
            'reason' => 'Damaged during inspection',
            'idempotency_key' => 'adjustment-1',
        ])->assertCreated()->assertJsonPath('inventory.available', 7);

        $this->assertDatabaseHas('products', ['id' => $productId, 'shop_id' => $shop->id, 'stock_quantity' => 7, 'status' => 'active']);
        $this->assertDatabaseHas('inventory_movements', ['movement_type' => 'manual_decrease', 'on_hand_delta' => -3, 'resulting_on_hand' => 7]);
    }

    public function test_seller_cannot_access_another_shops_products_or_inventory(): void
    {
        [$owner, , $category] = $this->sellerShop('owner');
        [$other] = $this->sellerShop('other');
        $created = $this->actingAs($owner)->postJson('/api/v1/seller/products', [
            'name' => 'Private Product', 'category_id' => $category->id, 'sku' => 'PRIVATE-1',
            'price' => 100, 'opening_stock' => 2,
        ])->assertCreated();

        $this->actingAs($other)->getJson('/api/v1/seller/products/'.$created->json('data.id'))->assertNotFound();
        $this->getJson('/api/v1/seller/inventory/'.$created->json('data.skus.0.id'))->assertNotFound();
        $this->getJson('/api/v1/seller/products')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_inventory_rejects_adjustment_below_available_stock_and_movements_are_immutable(): void
    {
        [$seller, , $category] = $this->sellerShop();
        $created = $this->actingAs($seller)->postJson('/api/v1/seller/products', [
            'name' => 'Small Stock', 'category_id' => $category->id, 'sku' => 'SMALL-1',
            'price' => 50, 'opening_stock' => 1,
        ])->assertCreated();

        $this->postJson('/api/v1/seller/inventory/'.$created->json('data.skus.0.id').'/adjustments', [
            'movement_type' => 'manual_decrease', 'quantity' => 2, 'reason' => 'Invalid decrease',
        ])->assertUnprocessable()->assertJsonValidationErrors('quantity');

        $movement = InventoryMovement::firstOrFail();
        $this->expectException(\LogicException::class);
        $movement->update(['reason' => 'Changed']);
    }

    public function test_seller_can_restore_an_archived_product_to_draft(): void
    {
        [$seller, , $category] = $this->sellerShop();
        $created = $this->actingAs($seller)->postJson('/api/v1/seller/products', [
            'name' => 'Restorable Product', 'category_id' => $category->id, 'sku' => 'RESTORE-1',
            'price' => 150, 'opening_stock' => 4,
        ])->assertCreated();
        $productId = $created->json('data.id');
        $skuId = $created->json('data.skus.0.id');

        $this->postJson("/api/v1/seller/products/{$productId}/archive")
            ->assertOk()
            ->assertJsonPath('data.status', 'archived');

        $this->postJson("/api/v1/seller/products/{$productId}/unarchive")
            ->assertOk()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.published_at', null);

        $this->assertDatabaseHas('inventory_skus', ['id' => $skuId, 'status' => 'active']);
        $this->postJson("/api/v1/seller/products/{$productId}/unarchive")->assertConflict();
    }

    private function sellerShop(string $suffix = 'one'): array
    {
        $seller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
        $shopCategory = ShopCategory::create(['name' => "General {$suffix}", 'slug' => "general-{$suffix}", 'status' => CategoryStatus::Active]);
        $shop = Shop::create(['seller_id' => $seller->id, 'shop_category_id' => $shopCategory->id, 'name' => "Shop {$suffix}", 'slug' => "shop-{$suffix}", 'status' => ShopStatus::Active]);
        $category = Category::create(['shop_category_id' => $shopCategory->id, 'name' => "Bags {$suffix}", 'slug' => "bags-{$suffix}", 'status' => CategoryStatus::Active]);

        return [$seller, $shop, $category];
    }
}
