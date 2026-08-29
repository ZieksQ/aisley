<?php

namespace Tests\Feature\Customer;

use App\Enums\ProductStatus;
use App\Enums\ProductVariantStatus;
use App\Enums\ShopStatus;
use App\Enums\UserStatus;
use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\ProductVariant;
use Database\Seeders\ProductSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductDetailTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_view_ordered_product_detail_with_only_valid_variant_combinations(): void
    {
        $this->seed(ProductSeeder::class);

        $product = Product::query()->where('slug', 'city-runner-sneakers')->firstOrFail();
        $invalidVariant = ProductVariant::query()->create([
            'product_id' => $product->id,
            'sku' => 'CRS-INCOMPLETE',
            'stock_quantity' => 5,
            'status' => ProductVariantStatus::Active,
        ]);
        $invalidMedia = ProductMedia::query()->create([
            'product_id' => $product->id,
            'product_variant_id' => $invalidVariant->id,
            'disk' => 'private',
            'path' => 'seller-only/incomplete-variant.jpg',
            'alt_text' => 'Invalid variant media',
            'position' => 99,
        ]);

        $response = $this->getJson('/api/v1/products/'.$product->id)
            ->assertOk()
            ->assertJsonPath('data.id', $product->id)
            ->assertJsonPath('data.title', 'City Runner Sneakers')
            ->assertJsonPath('data.descriptionMarkdown', $product->description_markdown)
            ->assertJsonPath('data.specifications.Upper', 'Breathable mesh')
            ->assertJsonPath('data.price', 2890)
            ->assertJsonPath('data.originalPrice', 3500)
            ->assertJsonPath('data.discountPercent', 17)
            ->assertJsonPath('data.availability.requiresVariantSelection', true)
            ->assertJsonPath('data.availability.stockQuantity', null)
            ->assertJsonPath('data.optionGroups.0.name', 'Color')
            ->assertJsonPath('data.optionGroups.1.name', 'Size')
            ->assertJsonCount(4, 'data.variants')
            ->assertJsonPath('data.shop.storefrontUrl', '/shops/aisley-demo-store')
            ->assertJsonPath('data.shop.isOnVacation', false)
            ->assertJsonMissing(['id' => $invalidVariant->id])
            ->assertJsonMissing(['id' => $invalidMedia->id]);

        $positions = collect($response->json('data.media'))->pluck('position')->all();
        $this->assertSame([0, 1, 2], $positions);

        $zeroStock = collect($response->json('data.variants'))->firstWhere('sku', 'CRS-RED-41');
        $this->assertSame(0, $zeroStock['stockQuantity']);
        $this->assertFalse($zeroStock['inStock']);

        $overridden = collect($response->json('data.variants'))->firstWhere('sku', 'CRS-WHT-41');
        $this->assertSame(2990, $overridden['price']);
        $this->assertSame(3500, $overridden['originalPrice']);

        $inherited = collect($response->json('data.variants'))->firstWhere('sku', 'CRS-WHT-40');
        $this->assertSame(2890, $inherited['price']);
        $this->assertSame(3500, $inherited['originalPrice']);

        $visibleMediaIds = collect($response->json('data.media'))->pluck('id')->all();
        $this->assertContains($overridden['primaryMediaId'], $visibleMediaIds);
    }

    public function test_product_without_variants_uses_product_level_price_and_stock(): void
    {
        $this->seed(ProductSeeder::class);

        $product = Product::query()->where('slug', 'compact-everyday-camera')->firstOrFail();

        $this->getJson('/api/v1/products/'.$product->id)
            ->assertOk()
            ->assertJsonCount(0, 'data.optionGroups')
            ->assertJsonCount(0, 'data.variants')
            ->assertJsonPath('data.price', 6750)
            ->assertJsonPath('data.originalPrice', 7900)
            ->assertJsonPath('data.availability.inStock', true)
            ->assertJsonPath('data.availability.stockQuantity', 14)
            ->assertJsonPath('data.availability.requiresVariantSelection', false);

        $product->media()->delete();
        $this->getJson('/api/v1/products/'.$product->id)
            ->assertOk()
            ->assertJsonCount(1, 'data.media')
            ->assertJsonPath('data.media.0.id', null)
            ->assertJsonPath('data.media.0.url', $product->thumbnail_path)
            ->assertJsonPath('data.media.0.altText', $product->name);
    }

    public function test_unavailable_product_shop_or_seller_is_hidden_as_not_found(): void
    {
        $this->seed(ProductSeeder::class);

        $product = Product::query()->where('slug', 'compact-everyday-camera')->firstOrFail();
        $url = '/api/v1/products/'.$product->id;

        $product->update(['status' => ProductStatus::Draft]);
        $this->getJson($url)->assertNotFound();

        $product->update(['status' => ProductStatus::Archived]);
        $this->getJson($url)->assertNotFound();

        $product->update(['status' => ProductStatus::Active, 'published_at' => now()->addHour()]);
        $this->getJson($url)->assertNotFound();

        $product->update(['published_at' => now()->subHour()]);
        $product->shop->update(['status' => ShopStatus::Suspended]);
        $this->getJson($url)->assertNotFound();

        $product->shop->update(['status' => ShopStatus::Active, 'is_on_vacation' => true]);
        $this->getJson($url)->assertNotFound();

        $product->shop->update(['is_on_vacation' => false]);
        $product->shop->seller->update(['status' => UserStatus::Suspended]);
        $this->getJson($url)->assertNotFound();

        $this->getJson('/api/v1/products/00000000-0000-4000-8000-000000000000')->assertNotFound();
        $this->getJson('/api/v1/products/not-a-uuid')->assertNotFound();
    }

    public function test_detail_dto_does_not_expose_storage_paths_or_internal_statuses(): void
    {
        $this->seed(ProductSeeder::class);

        $product = Product::query()->where('slug', 'studio-wireless-headphones')->firstOrFail();
        $payload = $this->getJson('/api/v1/products/'.$product->id)
            ->assertOk()
            ->json('data');
        $encoded = json_encode($payload, JSON_THROW_ON_ERROR);

        $this->assertStringNotContainsString('thumbnail_path', $encoded);
        $this->assertStringNotContainsString('seller-only', $encoded);
        $this->assertArrayNotHasKey('status', $payload);
        $this->assertArrayNotHasKey('status', $payload['shop']);
        $this->assertArrayNotHasKey('disk', $payload['media'][0]);
        $this->assertArrayNotHasKey('path', $payload['media'][0]);
        $this->assertArrayNotHasKey('status', $payload['variants'][0]);
    }
}
