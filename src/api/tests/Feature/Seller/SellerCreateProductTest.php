<?php

namespace Tests\Feature\Seller;

use App\Enums\CategoryStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductUpload;
use App\Models\Shop;
use App\Models\ShopCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class SellerCreateProductTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('product-test');
        config(['seller.products.asset_disk' => 'product-test']);
        Cache::flush();
    }

    public function test_variant_prices_inherit_or_override_and_skus_are_shop_scoped(): void
    {
        [$seller, $shop, $category] = $this->sellerShop('first');
        $token = (string) Str::uuid();
        $gallery = $this->upload($seller, $token, 'gallery');

        $created = $this->actingAs($seller)->postJson('/api/v1/seller/products', [
            'name' => 'Everyday Shirt', 'category_id' => $category->id, 'sku' => 'SHIRT',
            'price' => '500.00', 'original_price' => '600.00', 'upload_token' => $token,
            'gallery_upload_ids' => [$gallery],
            'option_groups' => [['name' => 'Color', 'values' => ['Black', 'White']]],
            'variants' => [
                ['sku' => 'SHIRT-BLK', 'price' => null, 'original_price' => null, 'opening_stock' => 3, 'option_value_indexes' => [0]],
                ['sku' => 'SHIRT-WHT', 'price' => '550.00', 'original_price' => '650.00', 'opening_stock' => 5, 'option_value_indexes' => [1]],
            ],
        ])->assertCreated()
            ->assertJsonPath('data.variants.0.inherits_price', true)
            ->assertJsonPath('data.variants.0.effective_price', '500.00')
            ->assertJsonPath('data.variants.1.effective_price', '550.00')
            ->assertJsonPath('data.variants.0.available', 3)
            ->assertJsonPath('data.variants.1.available', 5);

        $this->assertDatabaseHas('product_variants', ['shop_id' => $shop->id, 'sku' => 'SHIRT-WHT', 'price' => '550.00']);
        $this->assertDatabaseHas('inventory_skus', ['shop_id' => $shop->id, 'code' => 'SHIRT-WHT']);

        [$otherSeller, , $otherCategory] = $this->sellerShop('second');
        $this->actingAs($otherSeller)->postJson('/api/v1/seller/products', [
            'name' => 'Other Shirt', 'category_id' => $otherCategory->id, 'sku' => 'SHIRT-WHT',
            'price' => '300.00', 'opening_stock' => 0,
        ])->assertCreated();

        $this->actingAs($seller)->postJson('/api/v1/seller/products', [
            'name' => 'Duplicate', 'category_id' => $category->id, 'sku' => 'SHIRT-WHT',
            'price' => '300.00', 'opening_stock' => 0,
        ])->assertUnprocessable()->assertJsonValidationErrors('sku');

        $this->assertNotNull(Product::find($created->json('data.id')));
    }

    public function test_description_upload_is_temporary_then_claimed_and_moved_on_save(): void
    {
        [$seller, $shop, $category] = $this->sellerShop('description');
        $token = (string) Str::uuid();
        $assetId = $this->upload($seller, $token, 'description');
        $temporaryPath = "product-assets/temp/{$shop->id}/{$token}/{$assetId}.png";
        Storage::disk('product-test')->assertExists($temporaryPath);

        $product = $this->actingAs($seller)->postJson('/api/v1/seller/products', [
            'name' => 'Documented Product', 'category_id' => $category->id, 'sku' => 'DOC-1',
            'price' => '120.00', 'opening_stock' => 1, 'upload_token' => $token,
            'description_markdown' => "![Front view](/api/v1/product-description-assets/{$assetId})",
            'description_asset_ids' => [$assetId],
        ])->assertCreated();

        Storage::disk('product-test')->assertMissing($temporaryPath);
        Storage::disk('product-test')->assertExists("product-assets/{$shop->id}/{$product->json('data.id')}/description/{$assetId}.png");
        $this->assertDatabaseHas('product_description_assets', ['id' => $assetId, 'product_id' => $product->json('data.id'), 'scan_status' => 'approved']);
    }

    public function test_selected_product_gallery_image_is_the_customer_default_thumbnail(): void
    {
        [$seller, , $category] = $this->sellerShop('cover');
        $token = (string) Str::uuid();
        $firstGallery = $this->upload($seller, $token, 'gallery');
        $defaultGallery = $this->upload($seller, $token, 'gallery');

        $productId = $this->actingAs($seller)->postJson('/api/v1/seller/products', [
            'name' => 'Gallery Cover Product', 'category_id' => $category->id, 'sku' => 'COVER-1',
            'price' => '250.00', 'opening_stock' => 5, 'upload_token' => $token,
            'gallery_upload_ids' => [$firstGallery, $defaultGallery],
            'default_gallery_upload_id' => $defaultGallery,
        ])->assertCreated()->json('data.id');

        $this->assertDatabaseHas('product_media', ['id' => $firstGallery, 'product_id' => $productId, 'is_default' => false]);
        $this->assertDatabaseHas('product_media', ['id' => $defaultGallery, 'product_id' => $productId, 'is_default' => true]);

        $this->actingAs($seller)->patchJson("/api/v1/seller/products/{$productId}", [
            'default_gallery_media_id' => $firstGallery,
        ])->assertOk()
            ->assertJsonPath('data.gallery.0.is_default', true)
            ->assertJsonPath('data.gallery.1.is_default', false);

        $this->actingAs($seller)->postJson("/api/v1/seller/products/{$productId}/publish")
            ->assertOk();

        $this->getJson('/api/v1/customer/home')
            ->assertOk()
            ->assertJsonPath('topProducts.0.id', $productId)
            ->assertJsonPath('topProducts.0.thumbnailUrl', url("/api/v1/product-media/{$firstGallery}"))
            ->assertJsonPath('recommendations.items.0.id', $productId)
            ->assertJsonPath('recommendations.items.0.thumbnailUrl', url("/api/v1/product-media/{$firstGallery}"));
    }

    public function test_gallery_update_keeps_existing_images_when_adding_a_new_upload(): void
    {
        [$seller, , $category] = $this->sellerShop('gallery-append');
        $token = (string) Str::uuid();
        $firstGallery = $this->upload($seller, $token, 'gallery');
        $secondGallery = $this->upload($seller, $token, 'gallery');

        $productId = $this->actingAs($seller)->postJson('/api/v1/seller/products', [
            'name' => 'Gallery Append Product', 'category_id' => $category->id, 'sku' => 'GALLERY-APPEND',
            'price' => '250.00', 'opening_stock' => 5, 'upload_token' => $token,
            'gallery_upload_ids' => [$firstGallery, $secondGallery],
        ])->assertCreated()->json('data.id');

        $thirdGallery = $this->upload($seller, $token, 'gallery');
        $this->actingAs($seller)->patchJson("/api/v1/seller/products/{$productId}", [
            'upload_token' => $token,
            'gallery_media_ids' => [$firstGallery, $secondGallery],
            'gallery_upload_ids' => [$thirdGallery],
            'default_gallery_upload_id' => $thirdGallery,
        ])->assertOk()->assertJsonCount(3, 'data.gallery');

        $this->assertDatabaseHas('product_media', ['id' => $firstGallery, 'product_id' => $productId]);
        $this->assertDatabaseHas('product_media', ['id' => $secondGallery, 'product_id' => $productId]);
        $this->assertDatabaseHas('product_media', ['id' => $thirdGallery, 'product_id' => $productId, 'is_default' => true]);
    }

    public function test_manual_variant_rows_can_save_a_subset_of_option_combinations(): void
    {
        [$seller, , $category] = $this->sellerShop('manual-variants');

        $product = $this->actingAs($seller)->postJson('/api/v1/seller/products', [
            'name' => 'Manual Variant Product', 'category_id' => $category->id, 'sku' => 'MANUAL-VARIANTS',
            'price' => '250.00', 'option_groups' => [['name' => 'Color', 'values' => ['Black', 'White', 'Red']]],
            'variants' => [['sku' => 'MANUAL-BLACK', 'opening_stock' => 2, 'option_value_indexes' => [0]]],
        ])->assertCreated();

        $this->assertDatabaseCount('product_variants', 1);
        $product->assertJsonCount(1, 'data.variants');
        $this->assertDatabaseHas('inventory_skus', ['code' => 'MANUAL-BLACK']);
    }

    public function test_gallery_limit_and_invalid_variant_price_receive_field_errors(): void
    {
        [$seller, , $category] = $this->sellerShop('validation');
        $this->actingAs($seller)->postJson('/api/v1/seller/products', [
            'name' => 'Invalid Product', 'category_id' => $category->id, 'sku' => 'INVALID',
            'price' => '100.00', 'upload_token' => (string) Str::uuid(),
            'gallery_upload_ids' => collect(range(1, 11))->map(fn () => (string) Str::uuid())->all(),
            'option_groups' => [['name' => 'Size', 'values' => ['Small']]],
            'variants' => [['sku' => 'INVALID-S', 'price' => '150.00', 'original_price' => '120.00', 'option_value_indexes' => [0]]],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['gallery_upload_ids', 'variants.0.original_price']);
    }

    public function test_cleanup_command_removes_expired_uncommitted_upload(): void
    {
        [$seller, $shop] = $this->sellerShop('cleanup');
        $token = (string) Str::uuid();
        $assetId = $this->upload($seller, $token, 'gallery');
        $path = "product-assets/temp/{$shop->id}/{$token}/{$assetId}.png";
        ProductUpload::whereKey($assetId)->update(['expires_at' => now()->subMinute()]);

        $this->artisan('products:cleanup-assets')->assertSuccessful();

        Storage::disk('product-test')->assertMissing($path);
        $this->assertDatabaseMissing('product_uploads', ['id' => $assetId]);
    }

    private function upload(User $seller, string $token, string $purpose): string
    {
        return $this->actingAs($seller)->post('/api/v1/seller/product-uploads', [
            'image' => UploadedFile::fake()->createWithContent(
                "{$purpose}.png",
                base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true),
            ),
            'purpose' => $purpose,
            'upload_token' => $token,
            'alt_text' => 'Product image',
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.id');
    }

    private function sellerShop(string $suffix): array
    {
        $seller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
        $shopCategory = ShopCategory::create(['name' => "General {$suffix}", 'slug' => "general-{$suffix}", 'status' => CategoryStatus::Active]);
        $shop = Shop::create(['seller_id' => $seller->id, 'shop_category_id' => $shopCategory->id, 'name' => "Shop {$suffix}", 'slug' => "shop-{$suffix}", 'status' => ShopStatus::Active]);
        $category = Category::create(['shop_category_id' => $shopCategory->id, 'name' => "Products {$suffix}", 'slug' => "products-{$suffix}", 'status' => CategoryStatus::Active]);

        return [$seller, $shop, $category];
    }
}
