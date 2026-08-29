<?php

namespace App\Services\Seller;

use App\Enums\ProductStatus;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Shop;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

class DashboardService
{
    /**
     * @param  array{from?: string|null, to?: string|null, timezone?: string|null}  $filters
     * @return array<string, mixed>
     */
    public function forSeller(User $seller, array $filters): array
    {
        $shop = $seller->shop()->first();
        $period = $this->period($filters);

        if (! $shop) {
            return [
                'version' => 1,
                'code' => 'SHOP_SETUP_REQUIRED',
                'shop' => null,
                'period' => $period,
                'sections' => array_merge(
                    ['catalog' => $this->unavailableSection('SHOP_SETUP_REQUIRED')],
                    $this->deferredSections(),
                ),
                'actions' => [],
                'generated_at' => now()->utc()->toIso8601String(),
            ];
        }

        return [
            'version' => 1,
            'code' => null,
            'shop' => $this->shopSummary($shop),
            'period' => $period,
            'sections' => array_merge(
                ['catalog' => $this->catalogSection($shop)],
                $this->deferredSections(),
            ),
            'actions' => [],
            'generated_at' => now()->utc()->toIso8601String(),
        ];
    }

    /** @return array<string, mixed> */
    private function catalogSection(Shop $shop): array
    {
        $products = Product::query()->where('shop_id', $shop->id);
        $counts = (clone $products)
            ->selectRaw('status, COUNT(*) AS aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        $total = (int) $counts->sum();
        $nonArchivedProducts = (clone $products)
            ->where('status', '!=', ProductStatus::Archived);

        $zeroStockProducts = (clone $nonArchivedProducts)
            ->whereDoesntHave('variants')
            ->where('stock_quantity', 0)
            ->count();

        $zeroStockSkus = ProductVariant::query()
            ->where('stock_quantity', 0)
            ->whereHas('product', fn (Builder $query) => $query
                ->where('shop_id', $shop->id)
                ->where('status', '!=', ProductStatus::Archived))
            ->count();

        return [
            'state' => $total === 0 ? 'empty' : 'available',
            'metrics' => [
                'total' => $total,
                'active' => (int) $counts->get(ProductStatus::Active->value, 0),
                'draft' => (int) $counts->get(ProductStatus::Draft->value, 0),
                'archived' => (int) $counts->get(ProductStatus::Archived->value, 0),
                'zero_stock_products' => $zeroStockProducts,
                'zero_stock_skus' => $zeroStockSkus,
            ],
            'stock_signal' => 'catalog_quantity',
        ];
    }

    /** @return array<string, array{state: string, reason: string}> */
    private function deferredSections(): array
    {
        return [
            'financial' => $this->unavailableSection('DOMAIN_NOT_IMPLEMENTED'),
            'orders' => $this->unavailableSection('DOMAIN_NOT_IMPLEMENTED'),
            'inventory' => $this->unavailableSection('DOMAIN_NOT_IMPLEMENTED'),
            'reviews' => $this->unavailableSection('DOMAIN_NOT_IMPLEMENTED'),
            'traffic' => $this->unavailableSection('DOMAIN_NOT_IMPLEMENTED'),
            'notifications' => $this->unavailableSection('DOMAIN_NOT_IMPLEMENTED'),
        ];
    }

    /** @return array{state: string, reason: string} */
    private function unavailableSection(string $reason): array
    {
        return [
            'state' => 'unavailable',
            'reason' => $reason,
        ];
    }

    /** @return array{id: string, name: string, status: string, is_on_vacation: bool} */
    private function shopSummary(Shop $shop): array
    {
        return [
            'id' => $shop->id,
            'name' => $shop->name,
            'status' => $shop->status->value,
            'is_on_vacation' => $shop->is_on_vacation,
        ];
    }

    /**
     * @param  array{from?: string|null, to?: string|null, timezone?: string|null}  $filters
     * @return array{from: string|null, to: string|null, timezone: string, from_utc: string|null, to_utc_exclusive: string|null}
     */
    private function period(array $filters): array
    {
        $timezone = ($filters['timezone'] ?? null) ?: 'UTC';
        $from = $filters['from'] ?? null;
        $to = $filters['to'] ?? null;

        if (! $from || ! $to) {
            return [
                'from' => null,
                'to' => null,
                'timezone' => $timezone,
                'from_utc' => null,
                'to_utc_exclusive' => null,
            ];
        }

        $fromUtc = CarbonImmutable::createFromFormat('Y-m-d', $from, $timezone)
            ->startOfDay()
            ->utc();
        $toUtcExclusive = CarbonImmutable::createFromFormat('Y-m-d', $to, $timezone)
            ->startOfDay()
            ->addDay()
            ->utc();

        return [
            'from' => $from,
            'to' => $to,
            'timezone' => $timezone,
            'from_utc' => $fromUtc->toIso8601String(),
            'to_utc_exclusive' => $toUtcExclusive->toIso8601String(),
        ];
    }
}
