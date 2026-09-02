<?php

namespace App\Services\Customer;

use App\Models\Product;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

class ProductSearchService
{
    /**
     * @return LengthAwarePaginator<int, Product>
     */
    public function search(string $query, int $perPage): LengthAwarePaginator
    {
        $normalizedQuery = Str::lower($query);
        $escapedQuery = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $normalizedQuery);
        $contains = "%{$escapedQuery}%";
        $startsWith = "{$escapedQuery}%";

        return Product::query()
            ->select('products.*')
            ->storefrontVisible()
            ->with(['shop:id,name,slug', 'galleryMedia'])
            ->where(function (Builder $builder) use ($contains): void {
                $builder
                    ->whereRaw("LOWER(products.name) LIKE ? ESCAPE '!'", [$contains])
                    ->orWhereHas('shop', fn (Builder $shop) => $shop
                        ->whereRaw("LOWER(shops.name) LIKE ? ESCAPE '!'", [$contains]))
                    ->orWhereHas('category', fn (Builder $category) => $category
                        ->whereRaw("LOWER(categories.name) LIKE ? ESCAPE '!'", [$contains]));
            })
            ->orderByRaw(
                "CASE WHEN LOWER(products.name) = ? THEN 0 WHEN LOWER(products.name) LIKE ? ESCAPE '!' THEN 1 ELSE 2 END",
                [$normalizedQuery, $startsWith],
            )
            ->orderByDesc('products.sold_count')
            ->orderByDesc('products.review_count')
            ->orderBy('products.id')
            ->paginate($perPage);
    }
}
