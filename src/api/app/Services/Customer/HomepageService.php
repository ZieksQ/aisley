<?php

namespace App\Services\Customer;

use App\Enums\AddressType;
use App\Enums\CategoryStatus;
use App\Enums\HomepageAdvertisementStatus;
use App\Enums\HomepageCampaignPlacement;
use App\Http\Resources\Customer\HomepageCampaignResource;
use App\Http\Resources\Customer\HomepageCategoryResource;
use App\Http\Resources\Customer\ProductSummaryResource;
use App\Models\Category;
use App\Models\FlashDeal;
use App\Models\HomepageAdvertisementConfiguration;
use App\Models\HomepageCampaign;
use App\Models\Product;
use App\Models\RecentlyViewedProduct;
use App\Models\User;
use Illuminate\Contracts\Pagination\CursorPaginator;
use Illuminate\Pagination\Cursor;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

class HomepageService
{
    public function __construct(private readonly RecentlyViewedService $recentlyViewedService) {}

    /**
     * @return array<string, mixed>
     */
    public function overview(?User $customer, int $recommendationLimit): array
    {
        $campaigns = $this->activeCampaigns();

        return [
            'viewer' => $this->viewer($customer),
            'advertisementLayer' => $this->advertisementLayer(),
            'campaigns' => [
                'hero' => $campaigns
                    ->where('placement', HomepageCampaignPlacement::Hero->value)
                    ->take((int) config('homepage.campaigns.hero_limit', 6))
                    ->values(),
                'side' => $campaigns
                    ->where('placement', HomepageCampaignPlacement::HeroSide->value)
                    ->take((int) config('homepage.campaigns.side_limit', 2))
                    ->values(),
            ],
            'quickActions' => config('homepage.quick_actions', []),
            'categories' => $this->categories(),
            'flashDeals' => $this->flashDeals(),
            'topProducts' => $this->topProducts(),
            'recentlyViewed' => $this->recentlyViewed($customer),
            'recommendations' => $this->recommendations($customer, $recommendationLimit),
        ];
    }

    private function advertisementLayer(): ?array
    {
        /** @var array<string, mixed>|null $configuration */
        $configuration = Cache::remember(
            HomepageAdvertisementConfiguration::ACTIVE_CACHE_KEY,
            max(1, (int) config('homepage.public_cache_seconds', 300)),
            function (): ?array {
                $model = HomepageAdvertisementConfiguration::query()
                    ->with('campaigns')
                    ->where('status', HomepageAdvertisementStatus::Published)
                    ->latest('published_at')
                    ->first();

                if (! $model) {
                    return null;
                }

                return [
                    'layout' => $model->layout->value,
                    'rotationIntervalSeconds' => $model->rotation_interval_seconds,
                    'startsAtTimestamp' => $model->starts_at?->timestamp,
                    'endsAtTimestamp' => $model->ends_at?->timestamp,
                    'campaigns' => $model->campaigns
                        ->map(fn (HomepageCampaign $campaign) => (new HomepageCampaignResource($campaign))->resolve())
                        ->all(),
                ];
            },
        );

        if (! $configuration) {
            return null;
        }
        if (($configuration['startsAtTimestamp'] && $configuration['startsAtTimestamp'] > now()->timestamp)
            || ($configuration['endsAtTimestamp'] && $configuration['endsAtTimestamp'] <= now()->timestamp)) {
            return null;
        }
        $active = collect($configuration['campaigns'])->where('isActive', true)->sortBy('position')->values();
        $fallback = fn (string $slot) => ['id' => "default-{$slot}", 'title' => 'Discover more on Aisley', 'description' => 'Browse everyday essentials and fresh finds from marketplace sellers.', 'imageDesktopUrl' => null, 'imageMobileUrl' => null, 'altText' => 'Discover more on Aisley', 'destinationUrl' => '/search', 'isActive' => true, 'slot' => $slot, 'position' => 0];
        $primary = $active->where('slot', 'primary')->values();
        $layout = $configuration['layout'];
        if (in_array($layout, ['single', 'multi_block'], true) && $primary->isEmpty()) {
            $primary = collect([$fallback('primary')]);
        }
        if ($layout === 'multi_block_carousel' && $primary->isEmpty()) {
            $primary = collect([$fallback('primary')]);
        }

        return ['layout' => $layout, 'rotationIntervalSeconds' => $configuration['rotationIntervalSeconds'], 'primary' => $primary, 'secondaryTop' => $active->firstWhere('slot', 'secondary_top') ?? (str_starts_with($layout, 'multi_block') ? $fallback('secondary_top') : null), 'secondaryBottom' => $active->firstWhere('slot', 'secondary_bottom') ?? (str_starts_with($layout, 'multi_block') ? $fallback('secondary_bottom') : null)];
    }

    /**
     * @return array<string, mixed>
     */
    public function recommendations(?User $customer, int $limit, ?Cursor $cursor = null): array
    {
        $categoryAffinity = $this->categoryAffinity($customer);
        $query = Product::query()
            ->storefrontPurchasable()
            ->with(['shop:id,name,slug', 'galleryMedia'])
            ->orderByDesc('products.is_promoted')
            ->orderByDesc('products.sold_count')
            ->orderByDesc('products.review_count')
            ->orderByDesc('products.published_at')
            ->orderBy('products.id');

        /** @var CursorPaginator<int, Product> $paginator */
        $paginator = $query->cursorPaginate($limit, ['products.*'], 'cursor', $cursor);
        $nextCursor = $paginator->nextCursor()?->encode();
        $items = $this->diversify($paginator->getCollection(), $categoryAffinity);

        return [
            'items' => ProductSummaryResource::collection($items),
            'nextCursor' => $nextCursor,
            'pageSize' => $limit,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function viewer(?User $customer): array
    {
        if (! $customer) {
            return [
                'isAuthenticated' => false,
                'displayName' => null,
                'email' => null,
                'deliveryLocation' => null,
                'cartItemCount' => 0,
            ];
        }

        $customer->loadMissing('customerProfile');
        $address = $customer->addresses()
            ->where('is_default', true)
            ->whereIn('type', [AddressType::Shipping->value, AddressType::Both->value])
            ->latest('updated_at')
            ->first();

        return [
            'isAuthenticated' => true,
            'displayName' => $customer->customerProfile?->first_name,
            'email' => $customer->email,
            'deliveryLocation' => $address ? [
                'id' => $address->id,
                'label' => $address->label,
                'cityMunicipality' => $address->city_municipality,
                'province' => $address->province,
            ] : null,
            'cartItemCount' => 0,
        ];
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function activeCampaigns(): Collection
    {
        /** @var array<int, array{payload: array<string, mixed>, startsAtTimestamp: int, endsAtTimestamp: int}> $campaigns */
        $campaigns = Cache::remember(
            HomepageCampaign::CACHE_KEY,
            max(1, (int) config('homepage.public_cache_seconds', 300)),
            fn () => HomepageCampaign::query()
                ->where('is_active', true)
                ->where('ends_at', '>', now())
                ->orderByDesc('priority')
                ->orderByDesc('starts_at')
                ->get()
                ->map(fn (HomepageCampaign $campaign) => [
                    'payload' => (new HomepageCampaignResource($campaign))->resolve(),
                    'startsAtTimestamp' => $campaign->starts_at->timestamp,
                    'endsAtTimestamp' => $campaign->ends_at->timestamp,
                ])
                ->all(),
        );

        $timestamp = now()->timestamp;

        return collect($campaigns)
            ->filter(fn (array $campaign) => $campaign['startsAtTimestamp'] <= $timestamp
                && $campaign['endsAtTimestamp'] > $timestamp)
            ->pluck('payload')
            ->values();
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function categories(): Collection
    {
        /** @var array<int, array<string, mixed>> $categories */
        $categories = Cache::remember(
            Category::HOMEPAGE_CACHE_KEY,
            max(1, (int) config('homepage.public_cache_seconds', 300)),
            fn () => Category::query()
                ->whereNull('parent_id')
                ->where('status', CategoryStatus::Active)
                ->orderBy('name')
                ->limit((int) config('homepage.categories_limit', 20))
                ->get()
                ->map(fn (Category $category) => (new HomepageCategoryResource($category))->resolve())
                ->all(),
        );

        return collect($categories);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function flashDeals(): ?array
    {
        $deal = FlashDeal::query()
            ->where('is_active', true)
            ->where('starts_at', '<=', now())
            ->where('ends_at', '>', now())
            ->orderBy('ends_at')
            ->first();

        if (! $deal) {
            return null;
        }

        $products = $deal->products()
            ->storefrontPurchasable()
            ->whereColumn('flash_deal_products.sold_quantity', '<', 'flash_deal_products.deal_stock')
            ->whereColumn('flash_deal_products.deal_price', '<', 'products.price')
            ->with(['shop:id,name,slug', 'galleryMedia'])
            ->orderByDesc('flash_deal_products.sold_quantity')
            ->limit((int) config('homepage.flash_deals_limit', 12))
            ->get();

        if ($products->isEmpty()) {
            return null;
        }

        return [
            'id' => $deal->id,
            'title' => $deal->name,
            'startsAt' => $deal->starts_at->toISOString(),
            'endsAt' => $deal->ends_at->toISOString(),
            'products' => $products->map(fn (Product $product) => (new ProductSummaryResource($product))
                ->withPricing((string) $product->pivot->deal_price, (string) $product->price)
                ->withDealProgress(
                    (int) $product->pivot->deal_stock,
                    (int) $product->pivot->sold_quantity,
                )
                ->withBadge('flash_deal')),
        ];
    }

    private function topProducts(): Collection
    {
        return ProductSummaryResource::collection(
            Product::query()
                ->storefrontPurchasable()
                ->with(['shop:id,name,slug', 'galleryMedia'])
                ->orderByDesc('sold_count')
                ->orderByDesc('review_count')
                ->orderByDesc('average_rating')
                ->orderByDesc('published_at')
                ->limit((int) config('homepage.top_products_limit', 12))
                ->get(),
        )->collection->map(fn (ProductSummaryResource $resource) => $resource->withBadge('top_product'));
    }

    private function recentlyViewed(?User $customer): Collection
    {
        if (! $customer) {
            return collect();
        }

        return ProductSummaryResource::collection(
            $this->recentlyViewedService->homepageProducts(
                $customer,
                (int) config('homepage.recently_viewed_limit', 12),
            ),
        )->collection;
    }

    /**
     * @return list<string>
     */
    private function categoryAffinity(?User $customer): array
    {
        if (! $customer) {
            return [];
        }

        return RecentlyViewedProduct::query()
            ->where('user_id', $customer->id)
            ->join('products', 'products.id', '=', 'recently_viewed_products.product_id')
            ->whereNotNull('products.category_id')
            ->orderByDesc('recently_viewed_products.last_viewed_at')
            ->limit(20)
            ->pluck('products.category_id')
            ->unique()
            ->values()
            ->all();
    }

    /**
     * Reorder only within the fetched page so the database cursor remains stable.
     *
     * @param  Collection<int, Product>  $products
     * @param  list<string>  $categoryAffinity
     * @return Collection<int, Product>
     */
    private function diversify(Collection $products, array $categoryAffinity): Collection
    {
        if ($categoryAffinity !== []) {
            [$preferred, $other] = $products->partition(
                fn (Product $product) => in_array($product->category_id, $categoryAffinity, true),
            );
            $products = $preferred->concat($other)->values();
        }

        $pending = $products->values();
        $result = collect();
        $previousShopId = null;

        while ($pending->isNotEmpty()) {
            $nextIndex = $pending->search(
                fn (Product $product) => $product->shop_id !== $previousShopId,
            );
            $nextIndex = $nextIndex === false ? 0 : $nextIndex;
            /** @var Product $product */
            $product = $pending->pull($nextIndex);
            $pending = $pending->values();
            $result->push($product);
            $previousShopId = $product->shop_id;
        }

        return $result;
    }
}
