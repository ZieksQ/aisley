<?php

namespace App\Http\Controllers;

use App\Models\ProductDescriptionAsset;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProductDescriptionAssetController extends Controller
{
    public function __invoke(ProductDescriptionAsset $asset): StreamedResponse
    {
        abort_unless(
            $asset->scan_status === 'approved'
            && $asset->product()->storefrontVisible()->exists(),
            404,
        );

        return Storage::disk($asset->disk)->response($asset->path, null, [
            'Content-Type' => $asset->mime_type,
            'Cache-Control' => 'public, max-age=86400',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
