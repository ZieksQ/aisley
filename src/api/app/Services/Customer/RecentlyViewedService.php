<?php

namespace App\Services\Customer;

use App\Models\Product;
use App\Models\RecentlyViewedProduct;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\Cursor;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RecentlyViewedService
{
    public function record(User $customer, string $productId): RecentlyViewedProduct
    {
        return DB::transaction(function () use ($customer, $productId): RecentlyViewedProduct {
            User::query()->whereKey($customer->id)->lockForUpdate()->firstOrFail();
            $product = Product::query()->storefrontVisible()->findOrFail($productId);
            $viewedAt = now();

            RecentlyViewedProduct::query()->upsert([[
                'id' => (string) Str::uuid7(),
                'user_id' => $customer->id,
                'product_id' => $product->id,
                'last_viewed_at' => $viewedAt,
                'created_at' => $viewedAt,
                'updated_at' => $viewedAt,
            ]], ['user_id', 'product_id'], ['last_viewed_at', 'updated_at']);

            $this->prune($customer);

            return RecentlyViewedProduct::query()
                ->where('user_id', $customer->id)
                ->where('product_id', $product->id)
                ->firstOrFail();
        }, 3);
    }

    /**
     * @param  list<array{productId: string, viewedAt?: string|null}>  $items
     * @return list<string>
     */
    public function merge(User $customer, array $items): array
    {
        return DB::transaction(function () use ($customer, $items): array {
            User::query()->whereKey($customer->id)->lockForUpdate()->firstOrFail();

            $requestedIds = collect($items)->pluck('productId')->values();
            $visible = Product::query()
                ->storefrontVisible()
                ->whereIn('products.id', $requestedIds)
                ->pluck('products.id')
                ->flip();
            $existing = RecentlyViewedProduct::query()
                ->where('user_id', $customer->id)
                ->whereIn('product_id', $visible->keys())
                ->get()
                ->keyBy('product_id');
            $now = CarbonImmutable::now('UTC');
            $rows = [];
            $mergedIds = [];

            foreach ($items as $item) {
                $productId = $item['productId'];
                if (! $visible->has($productId)) {
                    continue;
                }

                $clientTime = isset($item['viewedAt']) && is_string($item['viewedAt'])
                    ? CarbonImmutable::parse($item['viewedAt'])->utc()
                    : $now;
                $persistedTime = $existing->get($productId)?->last_viewed_at;
                $viewedAt = $persistedTime && $persistedTime->gt($clientTime)
                    ? $persistedTime
                    : $clientTime;

                $rows[] = [
                    'id' => (string) Str::uuid7(),
                    'user_id' => $customer->id,
                    'product_id' => $productId,
                    'last_viewed_at' => $viewedAt,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
                $mergedIds[] = $productId;
            }

            if ($rows !== []) {
                RecentlyViewedProduct::query()->upsert(
                    $rows,
                    ['user_id', 'product_id'],
                    ['last_viewed_at', 'updated_at'],
                );
            }

            $this->prune($customer);

            return $mergedIds;
        }, 3);
    }

    public function list(User $customer, int $limit, ?Cursor $cursor): CursorPaginator
    {
        return RecentlyViewedProduct::query()
            ->where('recently_viewed_products.user_id', $customer->id)
            ->whereHas('product', fn (Builder $query) => $query->storefrontVisible())
            ->with(['product.shop:id,name,slug', 'product.galleryMedia'])
            ->orderByDesc('recently_viewed_products.last_viewed_at')
            ->orderByDesc('recently_viewed_products.id')
            ->cursorPaginate($limit, ['recently_viewed_products.*'], 'cursor', $cursor);
    }

    /**
     * @return Collection<int, Product>
     */
    public function homepageProducts(User $customer, int $limit): Collection
    {
        return RecentlyViewedProduct::query()
            ->where('user_id', $customer->id)
            ->whereHas('product', fn (Builder $query) => $query->storefrontVisible())
            ->with(['product.shop:id,name,slug', 'product.galleryMedia'])
            ->orderByDesc('last_viewed_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->pluck('product')
            ->filter()
            ->values();
    }

    /**
     * @param  list<string>  $productIds
     * @return Collection<int, Product>
     */
    public function resolveProducts(array $productIds): Collection
    {
        $products = Product::query()
            ->storefrontVisible()
            ->whereIn('products.id', $productIds)
            ->with(['shop:id,name,slug', 'galleryMedia'])
            ->get()
            ->keyBy('id');

        return collect($productIds)
            ->map(fn (string $productId) => $products->get($productId))
            ->filter()
            ->values();
    }

    public function remove(User $customer, string $productId): bool
    {
        return RecentlyViewedProduct::query()
            ->where('user_id', $customer->id)
            ->where('product_id', $productId)
            ->delete() > 0;
    }

    public function clear(User $customer): int
    {
        return RecentlyViewedProduct::query()
            ->where('user_id', $customer->id)
            ->delete();
    }

    private function prune(User $customer): void
    {
        $limit = max(1, (int) config('recently-viewed.retention_limit', 50));
        $retainedIds = RecentlyViewedProduct::query()
            ->where('user_id', $customer->id)
            ->orderByDesc('last_viewed_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->pluck('id');

        RecentlyViewedProduct::query()
            ->where('user_id', $customer->id)
            ->whereNotIn('id', $retainedIds)
            ->delete();
    }
}
