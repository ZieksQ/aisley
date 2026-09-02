<?php

namespace App\Http\Controllers\Seller;

use App\Enums\CategoryStatus;
use App\Enums\InventorySkuStatus;
use App\Enums\ProductStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Seller\StoreProductRequest;
use App\Http\Requests\Seller\UpdateProductRequest;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use App\Services\Seller\ProductAssetService;
use App\Services\Seller\ProductCatalogService;
use App\Services\Seller\SellerShopService;
use App\Support\MediaUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProductController extends Controller
{
    public function index(Request $request, SellerShopService $shops): JsonResponse
    {
        /** @var User $seller */ $seller = $request->user();
        $shop = $shops->for($seller);
        $products = $shop->products()->with(['category:id,name', 'inventorySkus.balance'])
            ->when($request->string('search')->toString(), fn ($q, $search) => $q->whereRaw('LOWER(name) LIKE ?', ['%'.strtolower($search).'%']))
            ->when($request->string('status')->toString(), fn ($q, $status) => $q->where('status', $status))
            ->latest()->paginate(15)->withQueryString();
        $products->through(fn (Product $product) => $this->payload($product));

        return response()->json($products);
    }

    public function options(Request $request, SellerShopService $shops): JsonResponse
    {
        /** @var User $seller */ $seller = $request->user();
        $shop = $shops->for($seller);

        return response()->json([
            'categories' => Category::query()
                ->where('shop_category_id', $shop->shop_category_id)->where('status', CategoryStatus::Active)
                ->orderBy('position')->orderBy('name')->get(['id', 'name']),
            'limits' => [
                'gallery_images' => (int) config('seller.products.gallery_image_limit'),
                'variant_images_per_variant' => 1,
                'image_max_bytes' => (int) config('seller.products.image_max_bytes'),
                'image_max_edge' => (int) config('seller.products.image_max_edge'),
                'image_max_pixels' => (int) config('seller.products.image_max_pixels'),
            ],
        ]);
    }

    public function store(StoreProductRequest $request, SellerShopService $shops, ProductCatalogService $catalog): JsonResponse
    {
        /** @var User $seller */ $seller = $request->user();
        $shop = $shops->for($seller);
        $data = $request->validated();
        $this->assertCategory($data['category_id'], $shop->shop_category_id);

        $product = $catalog->create($shop, $seller, $data);

        return response()->json(['data' => $this->payload($product)], 201);
    }

    public function show(Request $request, Product $product, SellerShopService $shops): JsonResponse
    {
        $this->assertOwned($request, $product, $shops);

        return response()->json(['data' => $this->payload($product)]);
    }

    public function update(UpdateProductRequest $request, Product $product, SellerShopService $shops, ProductCatalogService $catalog): JsonResponse
    {
        $shop = $this->assertOwned($request, $product, $shops);
        $data = $request->validated();
        if (isset($data['category_id'])) {
            $this->assertCategory($data['category_id'], $shop->shop_category_id);
        }
        /** @var User $seller */ $seller = $request->user();
        $catalog->update($product, $seller, $data);

        return response()->json(['data' => $this->payload($product)]);
    }

    public function publish(Request $request, Product $product, SellerShopService $shops): JsonResponse
    {
        $this->assertOwned($request, $product, $shops);
        abort_if($product->isComplianceRestricted(), 409, 'This product is restricted by Admin compliance review and cannot be published.');
        abort_unless($product->status === ProductStatus::Draft, 409, 'Only draft products can be published.');
        $product->load(['media', 'inventorySkus.balance', 'variants.inventorySku.balance', 'optionGroups.values', 'descriptionAssets']);
        $purchasable = $product->variants->isEmpty()
            ? ($product->inventorySkus->first()?->balance?->available() ?? 0) > 0
            : $product->variants->contains(fn ($variant) => $variant->status->value === 'active' && ($variant->inventorySku?->balance?->available() ?? 0) > 0);
        if (! $product->name || ! $product->category_id || (float) $product->price <= 0 || $product->media->whereNull('product_variant_id')->isEmpty() || ! $purchasable) {
            throw ValidationException::withMessages(['product' => 'Complete the catalog fields, add a gallery image, and ensure at least one active SKU has stock before publishing.']);
        }
        $product->update(['status' => ProductStatus::Active, 'published_at' => now()]);

        return response()->json(['data' => $this->payload($product)]);
    }

    public function archive(Request $request, Product $product, SellerShopService $shops): JsonResponse
    {
        $this->assertOwned($request, $product, $shops);
        abort_if($product->status === ProductStatus::Archived, 409, 'This product is already archived.');
        DB::transaction(function () use ($product) {
            $product->update(['status' => ProductStatus::Archived]);
            $product->inventorySkus()->update(['status' => InventorySkuStatus::Inactive->value]);
        });

        return response()->json(['data' => $this->payload($product)]);
    }

    public function unarchive(Request $request, Product $product, SellerShopService $shops): JsonResponse
    {
        $this->assertOwned($request, $product, $shops);
        abort_if($product->isComplianceRestricted(), 409, 'This product is restricted by Admin compliance review and cannot be unarchived.');
        abort_unless($product->status === ProductStatus::Archived, 409, 'Only archived products can be restored.');

        DB::transaction(function () use ($product) {
            $product->update([
                'status' => ProductStatus::Draft,
                'published_at' => null,
            ]);
            $product->inventorySkus()->update(['status' => InventorySkuStatus::Active->value]);
        });

        return response()->json(['data' => $this->payload($product)]);
    }

    public function destroy(Request $request, Product $product, SellerShopService $shops, ProductAssetService $assets): JsonResponse
    {
        $this->assertOwned($request, $product, $shops);
        abort_unless($product->status !== ProductStatus::Active, 409, 'Archive this Product before deleting it.');
        $assets->retireProduct($product);

        return response()->json(['message' => 'Product deleted. Its images remain recoverable until the configured retention period expires.']);
    }

    private function assertOwned(Request $request, Product $product, SellerShopService $shops)
    {
        /** @var User $seller */ $seller = $request->user();
        $shop = $shops->for($seller);
        abort_unless($product->shop_id === $shop->id, 404);

        return $shop;
    }

    private function assertCategory(string $categoryId, ?string $shopCategoryId): void
    {
        $valid = Category::whereKey($categoryId)->where('shop_category_id', $shopCategoryId)->where('status', CategoryStatus::Active)->exists();
        if (! $valid) {
            throw ValidationException::withMessages(['category_id' => 'Select a category available to this shop.']);
        }
    }

    private function payload(Product $product): array
    {
        $product->load([
            'category:id,name', 'inventorySkus.balance', 'activeComplianceRestriction:id,product_id,reason,imposed_at',
            'media', 'descriptionAssets', 'optionGroups.values', 'variants.optionValues', 'variants.inventorySku.balance',
        ]);

        return [
            'id' => $product->id, 'name' => $product->name, 'slug' => $product->slug,
            'base_sku' => $product->base_sku,
            'category_id' => $product->category_id, 'category' => $product->category?->name,
            'short_description' => $product->short_description, 'description_markdown' => $product->description_markdown,
            'price' => $product->price, 'original_price' => $product->original_price,
            'currency' => $product->currency,
            'status' => $product->status->value, 'published_at' => $product->published_at,
            'compliance' => [
                'is_restricted' => $product->activeComplianceRestriction !== null,
                'reason' => $product->activeComplianceRestriction?->reason,
                'restricted_at' => $product->activeComplianceRestriction?->imposed_at,
            ],
            'skus' => $product->inventorySkus->map(fn ($sku) => [
                'id' => $sku->id, 'code' => $sku->code, 'on_hand' => $sku->balance?->on_hand ?? 0,
                'reserved' => $sku->balance?->reserved ?? 0, 'available' => $sku->balance?->available() ?? 0,
            ]),
            'gallery' => $product->media->whereNull('product_variant_id')->values()->map(fn ($media) => [
                'id' => $media->id, 'url' => $media->mime_type
                    ? url('/api/v1/seller/product-media/'.$media->id)
                    : MediaUrl::from($media->disk, $media->path),
                'alt_text' => $media->alt_text, 'position' => $media->position,
                'is_default' => (bool) $media->is_default,
            ]),
            'description_asset_ids' => $product->descriptionAssets->pluck('id')->values(),
            'option_groups' => $product->optionGroups->map(fn ($group) => [
                'id' => $group->id, 'name' => $group->name,
                'values' => $group->values->sortBy('position')->map(fn ($value) => ['id' => $value->id, 'value' => $value->value])->values(),
            ])->values(),
            'variants' => $product->variants->map(fn ($variant) => [
                'id' => $variant->id, 'sku' => $variant->sku, 'price' => $variant->price,
                'original_price' => $variant->original_price, 'effective_price' => $variant->price ?? $product->price,
                'effective_original_price' => $variant->original_price ?? $product->original_price,
                'inherits_price' => $variant->price === null, 'status' => $variant->status->value,
                'option_value_ids' => $variant->optionValues->pluck('id')->values(),
                'inventory_sku_id' => $variant->inventorySku?->id,
                'on_hand' => $variant->inventorySku?->balance?->on_hand ?? 0,
                'reserved' => $variant->inventorySku?->balance?->reserved ?? 0,
                'available' => $variant->inventorySku?->balance?->available() ?? 0,
                'primary_media_id' => $variant->primary_media_id,
            ])->values(),
        ];
    }
}
