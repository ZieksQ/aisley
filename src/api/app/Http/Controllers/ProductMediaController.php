<?php

namespace App\Http\Controllers;

use App\Models\ProductMedia;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProductMediaController extends Controller
{
    public function __invoke(ProductMedia $media): StreamedResponse
    {
        abort_unless(
            $media->scan_status === 'approved'
            && $media->mime_type !== null
            && $media->product()->storefrontVisible()->exists(),
            404,
        );

        return Storage::disk($media->disk)->response($media->path, null, [
            'Content-Type' => $media->mime_type,
            'Cache-Control' => 'public, max-age=86400',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
