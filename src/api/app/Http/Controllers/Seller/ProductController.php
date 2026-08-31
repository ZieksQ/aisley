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
use App\Services\Seller\InventoryService;
use App\Services\Seller\SellerShopService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
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

        return response()->json(['categories' => Category::query()
            ->where('shop_category_id', $shop->shop_category_id)->where('status', CategoryStatus::Active)
            ->orderBy('position')->orderBy('name')->get(['id', 'name'])]);
    }

    public function store(StoreProductRequest $request, SellerShopService $shops, InventoryService $inventory): JsonResponse
    {
        /** @var User $seller */ $seller = $request->user();
        $shop = $shops->for($seller);
        $data = $request->validated();
        $this->assertCategory($data['category_id'], $shop->shop_category_id);

        $product = DB::transaction(function () use ($data, $shop, $inventory, $seller) {
            $product = $shop->products()->create([
                ...collect($data)->except(['sku', 'opening_stock'])->all(),
                'slug' => Str::slug($data['name']).'-'.Str::lower(Str::random(6)),
                'stock_quantity' => 0,
                'status' => ProductStatus::Draft,
            ]);
            $inventory->createBaseSku($product, strtoupper($data['sku']), $data['opening_stock'], $seller);

            return $product;
        });

        return response()->json(['data' => $this->payload($product)], 201);
    }

    public function show(Request $request, Product $product, SellerShopService $shops): JsonResponse
    {
        $this->assertOwned($request, $product, $shops);

        return response()->json(['data' => $this->payload($product)]);
    }

    public function update(UpdateProductRequest $request, Product $product, SellerShopService $shops): JsonResponse
    {
        $shop = $this->assertOwned($request, $product, $shops);
        $data = $request->validated();
        if (isset($data['category_id'])) {
            $this->assertCategory($data['category_id'], $shop->shop_category_id);
        }
        $product->update($data);

        return response()->json(['data' => $this->payload($product)]);
    }

    public function publish(Request $request, Product $product, SellerShopService $shops): JsonResponse
    {
        $this->assertOwned($request, $product, $shops);
        abort_if($product->isComplianceRestricted(), 409, 'This product is restricted by Admin compliance review and cannot be published.');
        abort_unless($product->status === ProductStatus::Draft, 409, 'Only draft products can be published.');
        if (! $product->name || ! $product->category_id || (float) $product->price <= 0) {
            throw ValidationException::withMessages(['product' => 'Complete the name, category, and price before publishing.']);
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
        $product->load(['category:id,name', 'inventorySkus.balance', 'activeComplianceRestriction:id,product_id,reason,imposed_at']);

        return [
            'id' => $product->id, 'name' => $product->name, 'slug' => $product->slug,
            'category_id' => $product->category_id, 'category' => $product->category?->name,
            'short_description' => $product->short_description, 'description_markdown' => $product->description_markdown,
            'price' => $product->price, 'original_price' => $product->original_price,
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
        ];
    }
}
