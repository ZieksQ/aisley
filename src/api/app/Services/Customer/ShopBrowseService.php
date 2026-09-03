<?php

namespace App\Services\Customer;

use App\Enums\CategoryStatus;
use App\Models\Category;
use App\Models\Product;
use App\Models\Shop;
use App\Models\ShopCategory;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Validation\ValidationException;

class ShopBrowseService
{
    /**
     * @return LengthAwarePaginator<int, Shop>
     */
    public function directory(?string $categorySlug, int $perPage): LengthAwarePaginator
    {
        return Shop::query()
            ->storefrontVisible()
            ->with(['shopCategory' => fn ($category) => $category
                ->where('status', CategoryStatus::Active)
                ->select('id', 'name', 'slug')])
            ->when($categorySlug, fn (Builder $query, string $slug) => $query
                ->whereHas('shopCategory', fn (Builder $category) => $category
                    ->where('status', CategoryStatus::Active)
                    ->where('slug', $slug)))
            ->orderByDesc('shops.created_at')
            ->orderByDesc('shops.id')
            ->paginate($perPage);
    }

    /**
     * @return Collection<int, ShopCategory>
     */
    public function directoryCategories(): Collection
    {
        return ShopCategory::query()
            ->where('status', CategoryStatus::Active)
            ->orderBy('position')
            ->orderBy('name')
            ->get(['id', 'slug', 'name']);
    }

    public function findPublicShop(string $slug): Shop
    {
        return Shop::query()
            ->storefrontVisible()
            ->with(['shopCategory' => fn ($category) => $category
                ->where('status', CategoryStatus::Active)
                ->select('id', 'name', 'slug')])
            ->where('slug', $slug)
            ->firstOrFail();
    }

    /**
     * @return Collection<int, Category>
     */
    public function productCategories(Shop $shop): Collection
    {
        return Category::query()
            ->select('categories.id', 'categories.slug', 'categories.name', 'categories.position')
            ->where('categories.status', CategoryStatus::Active)
            ->whereHas('products', fn (Builder $products) => $products
                ->storefrontVisible()
                ->where('products.shop_id', $shop->id))
            ->orderBy('categories.position')
            ->orderBy('categories.name')
            ->get();
    }

    /**
     * @param  Collection<int, Category>  $categories
     * @return LengthAwarePaginator<int, Product>
     */
    public function products(
        Shop $shop,
        Collection $categories,
        ?string $categorySlug,
        int $perPage,
    ): LengthAwarePaginator {
        $category = $categorySlug === null
            ? null
            : $categories->firstWhere('slug', $categorySlug);

        if ($categorySlug !== null && $category === null) {
            throw ValidationException::withMessages([
                'category' => ['The selected category is not available for this shop.'],
            ]);
        }

        return Product::query()
            ->select('products.*')
            ->storefrontVisible()
            ->where('products.shop_id', $shop->id)
            ->when($category, fn (Builder $query, Category $selected) => $query
                ->where('products.category_id', $selected->id))
            ->with(['shop:id,name,slug', 'galleryMedia'])
            ->orderByDesc('products.published_at')
            ->orderByDesc('products.id')
            ->paginate($perPage);
    }
}
