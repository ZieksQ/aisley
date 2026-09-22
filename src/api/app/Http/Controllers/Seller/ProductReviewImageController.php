<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Seller\ProductReviewService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProductReviewImageController extends Controller
{
    public function __invoke(Request $request, string $review, string $image, ProductReviewService $reviews): StreamedResponse
    {
        /** @var User $seller */
        $seller = $request->user();
        $asset = $reviews->image($seller, $review, $image);

        return Storage::disk($asset->disk)->response($asset->path, null, [
            'Content-Type' => $asset->mime_type,
            'Cache-Control' => 'private, no-store',
            'Pragma' => 'no-cache',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
