<?php

namespace App\Services\Customer;

use App\Enums\CategoryStatus;
use App\Models\Shop;
use App\Support\LiteralSearchText;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Str;

class ShopSearchService
{
    public function search(string $query, int $perPage): LengthAwarePaginator
    {
        $escaped = LiteralSearchText::escape($query);

        return Shop::query()
            ->select('shops.*')
            ->storefrontVisible()
            ->with(['shopCategory' => fn ($category) => $category
                ->where('status', CategoryStatus::Active)
                ->select('id', 'name', 'slug')])
            ->whereRaw("LOWER(shops.name) LIKE ? ESCAPE '!'", ['%'.$escaped.'%'])
            ->orderByRaw("CASE WHEN LOWER(shops.name) = ? THEN 0 WHEN LOWER(shops.name) LIKE ? ESCAPE '!' THEN 1 ELSE 2 END", [Str::lower($query), $escaped.'%'])
            ->orderByDesc('shops.created_at')
            ->orderBy('shops.id')
            ->paginate($perPage);
    }
}
