<?php

namespace App\Http\Resources\Customer;

use App\Enums\ProductStatus;
use App\Enums\ProductVariantStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Support\MediaUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CartItemResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $unitPrice = (float) ($this->variant?->price ?? $this->product->price);
        $availability = $this->availability();
        $media = $this->variant?->primaryMedia;
        $usesVariantMedia = $media !== null && $media->product_id === $this->product_id;
        $variantMediaUrl = $usesVariantMedia ? MediaUrl::from($media->disk, $media->path) : null;

        return [
            'id' => $this->id,
            'quantity' => $this->quantity,
            'unitPrice' => $unitPrice,
            'lineSubtotal' => round($unitPrice * $this->quantity, 2),
            'product' => [
                'id' => $this->product->id,
                'slug' => $this->product->slug,
                'name' => $this->product->name,
                'url' => '/products/'.$this->product->id,
            ],
            'variant' => $this->variant === null ? null : [
                'id' => $this->variant->id,
                'sku' => $this->variant->sku,
            ],
            'selectedOptions' => $this->selectedOptions(),
            'media' => [
                'url' => $variantMediaUrl
                    ?? MediaUrl::from($this->product->thumbnail_disk, $this->product->thumbnail_path),
                'altText' => $variantMediaUrl !== null && $media->alt_text
                    ? $media->alt_text
                    : $this->product->name,
            ],
            'availability' => $availability,
        ];
    }

    /** @return list<array{group: string, value: string}> */
    private function selectedOptions(): array
    {
        if ($this->variant === null) {
            return [];
        }

        return $this->variant->optionValues
            ->filter(fn ($value) => $value->optionGroup?->product_id === $this->product_id)
            ->sortBy([
                fn ($left, $right) => $left->optionGroup->position <=> $right->optionGroup->position,
                fn ($left, $right) => $left->position <=> $right->position,
            ])
            ->map(fn ($value) => [
                'group' => $value->optionGroup->name,
                'value' => $value->value,
            ])
            ->values()
            ->all();
    }

    /** @return array{isAvailable: bool, reason: ?string, availableQuantity: int} */
    private function availability(): array
    {
        $product = $this->product;
        $variant = $this->variant;
        $visible = $product->status === ProductStatus::Active
            && $product->published_at !== null
            && ! $product->published_at->isFuture()
            && $product->shop?->status === ShopStatus::Active
            && ! $product->shop->is_on_vacation
            && $product->shop->seller?->role === UserRole::Seller
            && $product->shop->seller?->status === UserStatus::Active
            && ! $product->isComplianceRestricted();

        if (! $visible) {
            return $this->availabilityResult(false, 'product_unavailable', 0);
        }

        $groupIds = $product->optionGroups->pluck('id')->sort()->values();
        if ($groupIds->isNotEmpty()) {
            if ($variant === null || $variant->product_id !== $product->id) {
                return $this->availabilityResult(false, 'variant_unavailable', 0);
            }

            $variantGroupIds = $variant->optionValues->pluck('option_group_id')->sort()->values();
            $complete = $variant->optionValues->count() === $groupIds->count()
                && $variantGroupIds->unique()->count() === $groupIds->count()
                && $variantGroupIds->all() === $groupIds->all();

            if (! $complete || $variant->status !== ProductVariantStatus::Active) {
                return $this->availabilityResult(false, 'variant_unavailable', 0);
            }
        } elseif ($variant !== null) {
            return $this->availabilityResult(false, 'variant_unavailable', 0);
        }

        $stock = $variant?->stock_quantity ?? $product->stock_quantity;

        if ($stock < 1) {
            return $this->availabilityResult(false, 'out_of_stock', 0);
        }

        if ($this->quantity > $stock) {
            return $this->availabilityResult(false, 'insufficient_stock', $stock);
        }

        return $this->availabilityResult(true, null, $stock);
    }

    /** @return array{isAvailable: bool, reason: ?string, availableQuantity: int} */
    private function availabilityResult(bool $available, ?string $reason, int $quantity): array
    {
        return [
            'isAvailable' => $available,
            'reason' => $reason,
            'availableQuantity' => $quantity,
        ];
    }
}
