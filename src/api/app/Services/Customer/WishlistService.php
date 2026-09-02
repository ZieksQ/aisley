<?php

namespace App\Services\Customer;

use App\Models\Product;
use App\Models\User;
use App\Models\WishlistItem;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Support\Facades\DB;

class WishlistService
{
    public function list(User $customer): CursorPaginator
    {
        return WishlistItem::query()
            ->where('user_id', $customer->id)
            ->whereHas('product', fn ($query) => $query->storefrontVisible())
            ->with([
                'product.shop',
                'product.optionGroups:id,product_id,name,position',
            ])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->cursorPaginate(20);
    }

    public function save(User $customer, string $productId): WishlistItem
    {
        return DB::transaction(function () use ($customer, $productId): WishlistItem {
            User::query()->whereKey($customer->id)->lockForUpdate()->firstOrFail();
            $product = Product::query()
                ->storefrontVisible()
                ->lockForUpdate()
                ->findOrFail($productId);

            return WishlistItem::query()->firstOrCreate([
                'user_id' => $customer->id,
                'product_id' => $product->id,
            ]);
        }, 3);
    }

    public function remove(User $customer, string $productId): void
    {
        DB::transaction(function () use ($customer, $productId): void {
            User::query()->whereKey($customer->id)->lockForUpdate()->firstOrFail();
            WishlistItem::query()
                ->where('user_id', $customer->id)
                ->where('product_id', $productId)
                ->delete();
        }, 3);
    }

    /** @param list<string> $productIds @return array<string, bool> */
    public function status(User $customer, array $productIds): array
    {
        $saved = WishlistItem::query()
            ->where('user_id', $customer->id)
            ->whereIn('product_id', $productIds)
            ->whereHas('product', fn ($query) => $query->storefrontVisible())
            ->pluck('product_id')
            ->flip();

        return collect($productIds)
            ->mapWithKeys(fn (string $productId) => [$productId => $saved->has($productId)])
            ->all();
    }
}
