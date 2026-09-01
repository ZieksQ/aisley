<?php

namespace App\Services\Seller;

use App\Models\Product;
use App\Models\ProductDescriptionAsset;
use App\Models\ProductMedia;
use App\Models\ProductUpload;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class ProductAssetService
{
    private const EXTENSIONS = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    public function uploadTemporary(User $seller, Shop $shop, UploadedFile $file, string $purpose, string $uploadToken, ?string $altText): ProductUpload
    {
        $metadata = $this->inspectAndRewrite($file);
        $id = (string) Str::uuid();
        $disk = (string) config('seller.products.asset_disk');
        $path = "product-assets/temp/{$shop->id}/{$uploadToken}/{$id}.{$metadata['extension']}";

        if (! Storage::disk($disk)->put($path, $metadata['bytes'])) {
            throw new RuntimeException('The image could not be stored.');
        }

        return ProductUpload::create([
            'id' => $id,
            'shop_id' => $shop->id,
            'seller_id' => $seller->id,
            'upload_token' => $uploadToken,
            'purpose' => $purpose,
            'disk' => $disk,
            'path' => $path,
            'mime_type' => $metadata['mime'],
            'byte_size' => strlen($metadata['bytes']),
            'width' => $metadata['width'],
            'height' => $metadata['height'],
            'checksum' => hash('sha256', $metadata['bytes']),
            'scan_status' => 'approved',
            'alt_text' => $altText,
            'expires_at' => now()->addHours((int) config('seller.products.temp_retention_hours')),
        ]);
    }

    /** @param list<string> $ids */
    public function claimGallery(Product $product, string $uploadToken, array $ids): void
    {
        $limit = (int) config('seller.products.gallery_image_limit');
        if (count($ids) > $limit) {
            throw ValidationException::withMessages(['gallery_upload_ids' => "A Product gallery may contain at most {$limit} images."]);
        }

        $variantMedia = $product->media()->whereNotNull('product_variant_id')->orderBy('position')->get()->values();
        $temporaryPosition = (int) ProductMedia::withTrashed()->where('product_id', $product->id)->max('position') + 1;
        $variantMedia->each(fn (ProductMedia $media, int $index) => $media->update(['position' => $temporaryPosition + $index]));
        $variantMedia->each(fn (ProductMedia $media, int $index) => $media->update(['position' => 1000 + $index]));
        $this->retireMedia($product->media()->whereNull('product_variant_id')->get());
        foreach (array_values($ids) as $position => $id) {
            $upload = $this->ownedUpload($product, $uploadToken, $id, 'gallery');
            $path = $this->move($upload, $product, 'gallery');
            ProductMedia::create($this->mediaAttributes($upload, $product, $path, $position));
            $upload->delete();
        }
    }

    public function claimVariantImage(Product $product, string $uploadToken, string $id, string $variantId, int $position): ProductMedia
    {
        $upload = $this->ownedUpload($product, $uploadToken, $id, 'variant');
        $path = $this->move($upload, $product, 'variants/'.$variantId);
        $media = ProductMedia::create([
            ...$this->mediaAttributes($upload, $product, $path, 1000 + $position),
            'product_variant_id' => $variantId,
        ]);
        $upload->delete();

        return $media;
    }

    /** @param list<string> $ids */
    public function claimDescription(Product $product, string $uploadToken, array $ids, string $markdown): void
    {
        $canonicalIds = $this->descriptionIds($markdown);
        if (array_values(array_unique($ids)) !== array_values(array_unique($canonicalIds))) {
            throw ValidationException::withMessages(['description_markdown' => 'Every description image must be an uploaded Aisley asset referenced exactly once in this Product.']);
        }
        if (count($ids) > (int) config('seller.products.description_image_limit')) {
            throw ValidationException::withMessages(['description_markdown' => 'The description contains too many images.']);
        }

        $keep = [];
        foreach ($ids as $id) {
            $existing = ProductDescriptionAsset::whereKey($id)->where('product_id', $product->id)->where('scan_status', 'approved')->first();
            if ($existing) {
                $existing->update(['referenced_at' => now(), 'purge_after' => null]);
                $keep[] = $existing->id;

                continue;
            }
            $upload = $this->ownedUpload($product, $uploadToken, $id, 'description');
            $path = $this->move($upload, $product, 'description');
            ProductDescriptionAsset::create([
                'id' => $upload->id, 'shop_id' => $product->shop_id, 'product_id' => $product->id,
                'disk' => $upload->disk, 'path' => $path, 'mime_type' => $upload->mime_type,
                'byte_size' => $upload->byte_size, 'width' => $upload->width, 'height' => $upload->height,
                'checksum' => $upload->checksum, 'scan_status' => 'approved', 'referenced_at' => now(),
            ]);
            $keep[] = $upload->id;
            $upload->delete();
        }

        $product->descriptionAssets()->whereNotIn('id', $keep)->get()->each(fn (ProductDescriptionAsset $asset) => $this->retire($asset));
    }

    public function retireProduct(Product $product): void
    {
        $purgeAt = now()->addDays((int) config('seller.products.deletion_retention_days'));
        $product->media()->get()->each(fn (ProductMedia $media) => $this->retire($media, $purgeAt));
        $product->descriptionAssets()->get()->each(fn (ProductDescriptionAsset $asset) => $this->retire($asset, $purgeAt));
        $product->update(['purge_after' => $purgeAt]);
        $product->delete();
    }

    private function inspectAndRewrite(UploadedFile $file): array
    {
        if ($file->getSize() >= (int) config('seller.products.image_max_bytes')) {
            throw ValidationException::withMessages(['image' => 'The image must be smaller than 10 MiB.']);
        }
        $name = $file->getClientOriginalName();
        if (substr_count($name, '.') !== 1) {
            throw ValidationException::withMessages(['image' => 'The image filename must have one valid extension.']);
        }
        $dimensions = @getimagesize($file->getRealPath());
        if ($dimensions === false || ! isset($dimensions['mime'])) {
            throw ValidationException::withMessages(['image' => 'The uploaded file is not a valid image.']);
        }
        [$width, $height] = [(int) $dimensions[0], (int) $dimensions[1]];
        if ($width < 1 || $height < 1 || $width > (int) config('seller.products.image_max_edge') || $height > (int) config('seller.products.image_max_edge') || $width * $height > (int) config('seller.products.image_max_pixels')) {
            throw ValidationException::withMessages(['image' => 'The image exceeds the 8,000-pixel edge or 40-megapixel limit.']);
        }
        $mime = (string) $dimensions['mime'];
        $extension = self::EXTENSIONS[$mime] ?? null;
        $clientExtension = strtolower($file->getClientOriginalExtension()) === 'jpeg' ? 'jpg' : strtolower($file->getClientOriginalExtension());
        if (! $extension || $extension !== $clientExtension) {
            throw ValidationException::withMessages(['image' => 'Only correctly named JPEG, PNG, or WebP images are allowed.']);
        }

        $source = match ($mime) {
            'image/jpeg' => @imagecreatefromjpeg($file->getRealPath()),
            'image/png' => @imagecreatefrompng($file->getRealPath()),
            'image/webp' => @imagecreatefromwebp($file->getRealPath()),
            default => false,
        };
        if ($source === false) {
            throw ValidationException::withMessages(['image' => 'The uploaded image could not be decoded.']);
        }
        ob_start();
        $written = match ($mime) {
            'image/jpeg' => imagejpeg($source, null, 90),
            'image/png' => imagepng($source, null, 6),
            'image/webp' => imagewebp($source, null, 90),
        };
        $bytes = ob_get_clean();
        imagedestroy($source);
        if (! $written || ! is_string($bytes) || $bytes === '') {
            throw ValidationException::withMessages(['image' => 'The uploaded image could not be safely rewritten.']);
        }

        return compact('mime', 'extension', 'width', 'height', 'bytes');
    }

    private function ownedUpload(Product $product, string $uploadToken, string $id, string $purpose): ProductUpload
    {
        $upload = ProductUpload::whereKey($id)->where('shop_id', $product->shop_id)->where('upload_token', $uploadToken)->where('purpose', $purpose)->where('scan_status', 'approved')->where('expires_at', '>', now())->first();
        if (! $upload) {
            throw ValidationException::withMessages(['uploads' => 'An image upload is missing, expired, or belongs to another Shop.']);
        }

        return $upload;
    }

    private function move(ProductUpload $upload, Product $product, string $folder): string
    {
        $extension = self::EXTENSIONS[$upload->mime_type];
        $path = "product-assets/{$product->shop_id}/{$product->id}/{$folder}/{$upload->id}.{$extension}";
        $storage = Storage::disk($upload->disk);
        if (! $storage->exists($path) && ! $storage->move($upload->path, $path)) {
            throw new RuntimeException('The image could not be finalized.');
        }

        return $path;
    }

    private function mediaAttributes(ProductUpload $upload, Product $product, string $path, int $position): array
    {
        return [
            'id' => $upload->id, 'product_id' => $product->id, 'disk' => $upload->disk, 'path' => $path,
            'alt_text' => $upload->alt_text ?: $product->name, 'position' => $position,
            'mime_type' => $upload->mime_type, 'byte_size' => $upload->byte_size, 'width' => $upload->width,
            'height' => $upload->height, 'checksum' => $upload->checksum, 'scan_status' => 'approved',
        ];
    }

    private function retireMedia($media): void
    {
        $nextPosition = $media->isEmpty()
            ? 100000
            : (int) ProductMedia::withTrashed()->where('product_id', $media->first()->product_id)->max('position') + 1;
        $media->values()->each(function (ProductMedia $item, int $index) use ($nextPosition): void {
            $item->update(['position' => $nextPosition + $index]);
            $this->retire($item);
        });
    }

    private function retire(ProductMedia|ProductDescriptionAsset $asset, $purgeAt = null): void
    {
        $asset->update(['purge_after' => $purgeAt ?? now()->addHours((int) config('seller.products.replacement_retention_hours'))]);
        $asset->delete();
    }

    /** @return list<string> */
    public function descriptionIds(string $markdown): array
    {
        preg_match_all('~!\[[^\]\r\n]{0,300}\]\(/api/v1/product-description-assets/([0-9a-f-]{36})\)~i', $markdown, $matches);

        return array_values(array_unique($matches[1] ?? []));
    }
}
