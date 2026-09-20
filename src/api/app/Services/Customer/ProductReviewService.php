<?php

namespace App\Services\Customer;

use App\Enums\OrderStatus;
use App\Exceptions\Customer\ProductReviewException;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductReview;
use App\Models\ProductReviewImage;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Throwable;

class ProductReviewService
{
    /** @return LengthAwarePaginator<int, ProductReview> */
    public function list(Product $product, int $perPage): LengthAwarePaginator
    {
        return ProductReview::query()
            ->published()
            ->where('product_id', $product->id)
            ->with(['images' => fn ($query) => $query
                ->where('status', 'approved')
                ->orderBy('position')])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();
    }

    /** @return array{averageRating: float|null, reviewCount: int, distribution: array<int, int>} */
    public function summary(Product $product): array
    {
        $query = ProductReview::query()
            ->published()
            ->where('product_id', $product->id);
        $aggregate = (clone $query)
            ->selectRaw('COUNT(*) as review_count, AVG(rating) as average_rating')
            ->first();
        $distribution = (clone $query)
            ->selectRaw('rating, COUNT(*) as total')
            ->groupBy('rating')
            ->pluck('total', 'rating')
            ->map(fn (mixed $total): int => (int) $total);

        return [
            'averageRating' => $aggregate?->average_rating === null
                ? null
                : round((float) $aggregate->average_rating, 2),
            'reviewCount' => (int) ($aggregate?->review_count ?? 0),
            'distribution' => collect(range(1, 5))
                ->mapWithKeys(fn (int $rating): array => [$rating => $distribution->get($rating, 0)])
                ->all(),
        ];
    }

    /** @return array{review: ProductReview, created: bool} */
    public function create(User $customer, string $orderItemId, int $rating, string $body): array
    {
        $reviewId = null;
        $created = false;

        DB::transaction(function () use ($customer, $orderItemId, $rating, $body, &$reviewId, &$created): void {
            $item = OrderItem::query()->whereKey($orderItemId)->lockForUpdate()->first();
            if ($item === null) {
                throw ProductReviewException::notFound('This delivered Order item is not available for review.');
            }

            $order = Order::query()->whereKey($item->order_id)->lockForUpdate()->first();
            if ($order === null || $order->customer_id !== $customer->id) {
                throw ProductReviewException::notFound('This delivered Order item is not available for review.');
            }

            $existing = ProductReview::query()
                ->where('order_item_id', $item->id)
                ->lockForUpdate()
                ->first();
            if ($existing !== null) {
                if ((int) $existing->rating !== $rating || $existing->body !== $body) {
                    throw ProductReviewException::conflict(
                        'PRODUCT_REVIEW_ALREADY_SUBMITTED',
                        'This Order item already has a different review.',
                    );
                }

                $reviewId = $existing->id;

                return;
            }

            if ($order->status !== OrderStatus::Delivered) {
                throw ProductReviewException::conflict(
                    'PRODUCT_REVIEW_NOT_ELIGIBLE',
                    'A Product review can be submitted only after the Order is delivered.',
                );
            }

            if (! is_string($item->product_id) || $item->product_id === '') {
                throw ProductReviewException::conflict(
                    'PRODUCT_REVIEW_PRODUCT_UNAVAILABLE',
                    'This Order item no longer references a reviewable Product.',
                );
            }

            $product = Product::query()->whereKey($item->product_id)->lockForUpdate()->first();
            if ($product === null) {
                throw ProductReviewException::conflict(
                    'PRODUCT_REVIEW_PRODUCT_UNAVAILABLE',
                    'This Product is no longer available for review.',
                );
            }

            $review = ProductReview::query()->create([
                'customer_id' => $customer->id,
                'order_id' => $order->id,
                'order_item_id' => $item->id,
                'product_id' => $product->id,
                'product_variant_id' => $item->product_variant_id,
                'product_name_snapshot' => $item->product_name,
                'variant_name_snapshot' => $item->variant_name,
                'rating' => $rating,
                'body' => $body,
                'status' => ProductReview::STATUS_PUBLISHED,
                'published_at' => now(),
            ]);

            $this->refreshProductAggregate($product);
            $reviewId = $review->id;
            $created = true;
        }, 3);

        $review = ProductReview::query()->with('images')->findOrFail($reviewId);

        return ['review' => $review, 'created' => $created];
    }

    public function uploadImage(User $customer, string $reviewId, UploadedFile $file): ProductReviewImage
    {
        $metadata = $this->inspectAndRewrite($file);
        $disk = (string) config('customer.reviews.asset_disk');
        $path = null;

        try {
            $image = DB::transaction(function () use ($customer, $reviewId, $metadata, $disk, &$path): ProductReviewImage {
                $review = ProductReview::query()
                    ->whereKey($reviewId)
                    ->where('customer_id', $customer->id)
                    ->lockForUpdate()
                    ->first();
                if ($review === null) {
                    throw ProductReviewException::notFound('This Product review is not available for image upload.');
                }

                $position = (int) $review->images()->lockForUpdate()->max('position');
                $count = $review->images()->lockForUpdate()->count();
                if ($count >= (int) config('customer.reviews.image_limit')) {
                    throw ProductReviewException::conflict(
                        'PRODUCT_REVIEW_IMAGE_LIMIT_REACHED',
                        'A Product review may contain at most '.(int) config('customer.reviews.image_limit').' photos.',
                        'image',
                    );
                }

                $imageId = (string) Str::uuid();
                $path = 'product-review-images/'.$review->product_id.'/'.$review->id.'/'.$imageId.'.'.$metadata['extension'];
                if (! Storage::disk($disk)->put($path, $metadata['bytes'])) {
                    throw new RuntimeException('The review image could not be stored.');
                }

                return ProductReviewImage::query()->create([
                    'id' => $imageId,
                    'review_id' => $review->id,
                    'customer_id' => $customer->id,
                    'disk' => $disk,
                    'path' => $path,
                    'mime_type' => $metadata['mime'],
                    'byte_size' => strlen($metadata['bytes']),
                    'width' => $metadata['width'],
                    'height' => $metadata['height'],
                    'checksum' => hash('sha256', $metadata['bytes']),
                    'status' => 'approved',
                    'position' => $count === 0 ? 0 : $position + 1,
                ]);
            }, 3);
        } catch (Throwable $exception) {
            if (is_string($path)) {
                try {
                    Storage::disk($disk)->delete($path);
                } catch (Throwable) {
                    // Preserve the original failure; cleanup is best effort.
                }
            }

            throw $exception;
        }

        return $image;
    }

    private function refreshProductAggregate(Product $product): void
    {
        $aggregate = ProductReview::query()
            ->published()
            ->where('product_id', $product->id)
            ->selectRaw('COUNT(*) as review_count, AVG(rating) as average_rating')
            ->first();

        $product->forceFill([
            'review_count' => (int) ($aggregate?->review_count ?? 0),
            'average_rating' => $aggregate?->average_rating === null
                ? null
                : round((float) $aggregate->average_rating, 2),
        ])->save();
    }

    /** @return array{mime: string, extension: string, width: int, height: int, bytes: string} */
    private function inspectAndRewrite(UploadedFile $file): array
    {
        if ($file->getSize() >= (int) config('customer.reviews.image_max_bytes')) {
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

        $width = (int) $dimensions[0];
        $height = (int) $dimensions[1];
        if ($width < 1 || $height < 1
            || $width > (int) config('customer.reviews.image_max_edge')
            || $height > (int) config('customer.reviews.image_max_edge')
            || $width * $height > (int) config('customer.reviews.image_max_pixels')) {
            throw ValidationException::withMessages(['image' => 'The image exceeds the 8,000-pixel edge or 40-megapixel limit.']);
        }

        $mime = (string) $dimensions['mime'];
        $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        $extension = $extensions[$mime] ?? null;
        $clientExtension = strtolower($file->getClientOriginalExtension());
        if ($clientExtension === 'jpeg') {
            $clientExtension = 'jpg';
        }
        if ($extension === null || $clientExtension !== $extension) {
            throw ValidationException::withMessages(['image' => 'Only correctly named JPEG, PNG, or WebP images are allowed.']);
        }

        $decoder = match ($mime) {
            'image/jpeg' => 'imagecreatefromjpeg',
            'image/png' => 'imagecreatefrompng',
            'image/webp' => 'imagecreatefromwebp',
            default => null,
        };
        $encoder = match ($mime) {
            'image/jpeg' => 'imagejpeg',
            'image/png' => 'imagepng',
            'image/webp' => 'imagewebp',
            default => null,
        };
        if ($decoder === null || $encoder === null || ! function_exists($decoder) || ! function_exists($encoder)) {
            throw ValidationException::withMessages(['image' => 'Image decoding is not available on this server.']);
        }

        $source = @$decoder($file->getRealPath());
        if ($source === false) {
            throw ValidationException::withMessages(['image' => 'The uploaded image could not be decoded.']);
        }

        ob_start();
        $written = match ($mime) {
            'image/jpeg' => @$encoder($source, null, 90),
            'image/png' => @$encoder($source, null, 6),
            'image/webp' => @$encoder($source, null, 90),
        };
        $bytes = ob_get_clean();
        imagedestroy($source);
        if (! $written || ! is_string($bytes) || $bytes === '') {
            throw ValidationException::withMessages(['image' => 'The uploaded image could not be safely rewritten.']);
        }

        return compact('mime', 'extension', 'width', 'height', 'bytes');
    }
}
