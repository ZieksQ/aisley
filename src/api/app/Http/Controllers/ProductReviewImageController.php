<?php

namespace App\Http\Controllers;

use App\Models\ProductReviewImage;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProductReviewImageController extends Controller
{
    public function __invoke(string $image): StreamedResponse
    {
        $reviewImage = ProductReviewImage::query()
            ->with(['review.product'])
            ->whereKey($image)
            ->where('status', 'approved')
            ->firstOrFail();
        $review = $reviewImage->review;

        abort_unless(
            $review !== null
            && $review->status === 'published'
            && $review->published_at?->isPast()
            && $review->product !== null
            && $review->product->newQuery()->storefrontVisible()->whereKey($review->product_id)->exists(),
            404,
        );

        return Storage::disk($reviewImage->disk)->response($reviewImage->path, null, [
            'Content-Type' => $reviewImage->mime_type,
            'Cache-Control' => 'public, max-age=300',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
