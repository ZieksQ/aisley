<?php

namespace App\Http\Resources\Customer;

use App\Models\ProductVariant;
use App\Support\MediaUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

class ProductDetailResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $variants = $this->validVariants();
        $variantIds = $variants->pluck('id')->all();
        $price = (float) $this->price;
        $originalPrice = $this->legitimateOriginalPrice($price, $this->original_price);
        $hasVariants = $this->optionGroups->isNotEmpty();
        $media = $this->visibleMedia($variantIds);
        $visibleMediaIds = $media->pluck('id')->filter()->all();

        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'title' => $this->name,
            'shortDescription' => $this->short_description,
            'descriptionMarkdown' => $this->description_markdown,
            'specifications' => $this->specifications,
            'price' => $price,
            'originalPrice' => $originalPrice,
            'discountPercent' => $this->discountPercent($price, $originalPrice),
            'badges' => array_values(array_filter((array) $this->badges, 'is_string')),
            'averageRating' => $this->review_count > 0 && $this->average_rating !== null
                ? (float) $this->average_rating
                : null,
            'reviewCount' => $this->review_count,
            'soldCount' => $this->sold_count,
            'availability' => [
                'inStock' => $hasVariants
                    ? $variants->contains(fn (ProductVariant $variant) => $variant->stock_quantity > 0)
                    : $this->stock_quantity > 0,
                'stockQuantity' => $hasVariants ? null : $this->stock_quantity,
                'requiresVariantSelection' => $hasVariants,
            ],
            'media' => $media,
            'optionGroups' => $this->optionGroups->map(fn ($group) => [
                'id' => $group->id,
                'name' => $group->name,
                'position' => $group->position,
                'values' => $group->values->map(fn ($value) => [
                    'id' => $value->id,
                    'value' => $value->value,
                    'position' => $value->position,
                    'swatch' => [
                        'color' => $value->swatch_color,
                        'imageUrl' => MediaUrl::from('public', $value->swatch_image_path),
                    ],
                ])->values(),
            ])->values(),
            'variants' => $variants
                ->map(fn (ProductVariant $variant) => $this->variant($variant, $visibleMediaIds))
                ->values(),
            'shop' => [
                'id' => $this->shop->id,
                'slug' => $this->shop->slug,
                'name' => $this->shop->name,
                'logoUrl' => MediaUrl::from('public', $this->shop->logo_path),
                'isOnVacation' => $this->shop->is_on_vacation,
                'vacationMessage' => $this->shop->vacation_message,
                'storefrontUrl' => '/shops/'.$this->shop->slug,
            ],
        ];
    }

    /** @return Collection<int, ProductVariant> */
    private function validVariants(): Collection
    {
        $groupIds = $this->optionGroups->pluck('id')->sort()->values();

        if ($groupIds->isEmpty()) {
            return collect();
        }

        return $this->variants
            ->filter(function (ProductVariant $variant) use ($groupIds): bool {
                $variantGroupIds = $variant->optionValues
                    ->pluck('option_group_id')
                    ->sort()
                    ->values();

                return $variant->optionValues->count() === $groupIds->count()
                    && $variantGroupIds->unique()->count() === $groupIds->count()
                    && $variantGroupIds->all() === $groupIds->all();
            })
            ->values();
    }

    /** @return array<string, mixed> */
    private function variant(ProductVariant $variant, array $visibleMediaIds): array
    {
        $price = $variant->price === null ? (float) $this->price : (float) $variant->price;
        $rawOriginalPrice = $variant->original_price ?? $this->original_price;
        $originalPrice = $this->legitimateOriginalPrice($price, $rawOriginalPrice);

        return [
            'id' => $variant->id,
            'sku' => $variant->sku,
            'optionValueIds' => $variant->optionValues->pluck('id')->values(),
            'price' => $price,
            'originalPrice' => $originalPrice,
            'discountPercent' => $this->discountPercent($price, $originalPrice),
            'stockQuantity' => $variant->stock_quantity,
            'inStock' => $variant->stock_quantity > 0,
            'primaryMediaId' => in_array($variant->primary_media_id, $visibleMediaIds, true)
                ? $variant->primary_media_id
                : null,
        ];
    }

    /**
     * @param  list<string>  $variantIds
     * @return Collection<int, array<string, mixed>>
     */
    private function visibleMedia(array $variantIds): Collection
    {
        $media = $this->media
            ->filter(fn ($item) => $item->product_variant_id === null
                || in_array($item->product_variant_id, $variantIds, true))
            ->map(fn ($item) => [
                'id' => $item->id,
                'url' => MediaUrl::from($item->disk, $item->path),
                'altText' => $item->alt_text ?: $this->name,
                'position' => $item->position,
                'variantId' => $item->product_variant_id,
            ])
            ->filter(fn (array $item) => $item['url'] !== null)
            ->values();

        $thumbnailUrl = MediaUrl::from($this->thumbnail_disk, $this->thumbnail_path);
        if ($media->isEmpty() && $thumbnailUrl !== null) {
            $media->push([
                'id' => null,
                'url' => $thumbnailUrl,
                'altText' => $this->name,
                'position' => 0,
                'variantId' => null,
            ]);
        }

        return $media;
    }

    private function legitimateOriginalPrice(float $price, mixed $originalPrice): ?float
    {
        if ($originalPrice === null || (float) $originalPrice <= $price) {
            return null;
        }

        return (float) $originalPrice;
    }

    private function discountPercent(float $price, ?float $originalPrice): ?int
    {
        return $originalPrice === null
            ? null
            : (int) round((1 - ($price / $originalPrice)) * 100);
    }
}
