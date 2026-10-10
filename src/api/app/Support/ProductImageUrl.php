<?php

namespace App\Support;

use App\Models\Product;
use App\Models\ProductMedia;
use App\Models\ProductVariant;

class ProductImageUrl
{
    public static function from(?Product $product, ?ProductVariant $variant = null): ?string
    {
        if ($product === null) {
            return null;
        }

        $variantMedia = $variant?->primaryMedia;
        if ($variantMedia !== null
            && $variantMedia->product_id === $product->id
            && $variantMedia->scan_status === 'approved') {
            return self::mediaUrl($variantMedia);
        }

        $gallery = $product->relationLoaded('galleryMedia')
            ? $product->galleryMedia
            : collect();
        $media = $gallery->first(fn (ProductMedia $item) => $item->is_default)
            ?? $gallery->first();

        return $media === null
            ? MediaUrl::from($product->thumbnail_disk, $product->thumbnail_path)
            : self::mediaUrl($media);
    }

    private static function mediaUrl(ProductMedia $media): ?string
    {
        return $media->mime_type !== null
            ? url('/api/v1/product-media/'.$media->id)
            : MediaUrl::from($media->disk, $media->path);
    }
}
