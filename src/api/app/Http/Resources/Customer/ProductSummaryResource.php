<?php

namespace App\Http\Resources\Customer;

use App\Models\ProductMedia;
use App\Support\MediaUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductSummaryResource extends JsonResource
{
    private ?string $priceOverride = null;

    private ?string $originalPriceOverride = null;

    /** @var list<string> */
    private array $additionalBadges = [];

    private ?int $dealStock = null;

    private ?int $dealSoldCount = null;

    public function withPricing(string $price, ?string $originalPrice = null): static
    {
        $this->priceOverride = $price;
        $this->originalPriceOverride = $originalPrice;

        return $this;
    }

    public function withBadge(string $badge): static
    {
        $this->additionalBadges[] = $badge;

        return $this;
    }

    public function withDealProgress(int $stock, int $soldCount): static
    {
        $this->dealStock = max(0, $stock);
        $this->dealSoldCount = max(0, min($soldCount, $this->dealStock));

        return $this;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $price = $this->priceOverride ?? $this->price;
        $originalPrice = $this->originalPriceOverride ?? $this->original_price;
        $validOriginalPrice = $originalPrice !== null && (float) $originalPrice > (float) $price
            ? (float) $originalPrice
            : null;
        $badges = array_values(array_unique(array_filter([
            ...array_filter((array) $this->badges, 'is_string'),
            ...$this->additionalBadges,
        ])));

        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'title' => $this->name,
            'thumbnailUrl' => $this->thumbnailUrl(),
            'price' => (float) $price,
            'originalPrice' => $validOriginalPrice,
            'minPrice' => null,
            'maxPrice' => null,
            'discountPercent' => $validOriginalPrice === null
                ? null
                : (int) round((1 - ((float) $price / $validOriginalPrice)) * 100),
            'averageRating' => $this->review_count > 0 && $this->average_rating !== null
                ? (float) $this->average_rating
                : null,
            'reviewCount' => $this->review_count,
            'soldCount' => $this->sold_count,
            'stockStatus' => $this->stockStatus(),
            'shop' => [
                'id' => $this->shop->id,
                'slug' => $this->shop->slug,
                'name' => $this->shop->name,
            ],
            'badges' => $badges,
            'deal' => $this->when($this->dealStock !== null, fn () => [
                'stock' => $this->dealStock,
                'soldCount' => $this->dealSoldCount,
                'remainingStock' => $this->dealStock - $this->dealSoldCount,
                'progressPercent' => $this->dealStock === 0
                    ? 0
                    : (int) round(($this->dealSoldCount / $this->dealStock) * 100),
            ]),
        ];
    }

    private function stockStatus(): string
    {
        if ($this->stock_quantity <= 0) {
            return 'out_of_stock';
        }

        return $this->stock_quantity <= (int) config('homepage.low_stock_threshold', 5)
            ? 'low_stock'
            : 'in_stock';
    }

    private function thumbnailUrl(): ?string
    {
        /** @var ProductMedia|null $media */
        $media = $this->relationLoaded('galleryMedia')
            ? $this->galleryMedia->first()
            : null;

        if ($media) {
            return $media->mime_type !== null
                ? url('/api/v1/product-media/'.$media->id)
                : MediaUrl::from($media->disk, $media->path);
        }

        return MediaUrl::from($this->thumbnail_disk, $this->thumbnail_path);
    }
}
