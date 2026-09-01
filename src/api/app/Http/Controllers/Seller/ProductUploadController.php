<?php

namespace App\Http\Controllers\Seller;

use App\Http\Controllers\Controller;
use App\Http\Requests\Seller\StoreProductUploadRequest;
use App\Models\ProductDescriptionAsset;
use App\Models\ProductMedia;
use App\Models\ProductUpload;
use App\Models\User;
use App\Services\Seller\ProductAssetService;
use App\Services\Seller\SellerShopService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProductUploadController extends Controller
{
    public function store(StoreProductUploadRequest $request, SellerShopService $shops, ProductAssetService $assets): JsonResponse
    {
        /** @var User $seller */ $seller = $request->user();
        $shop = $shops->for($seller);
        $upload = $assets->uploadTemporary(
            $seller,
            $shop,
            $request->file('image'),
            $request->string('purpose')->toString(),
            $request->string('upload_token')->toString(),
            $request->input('alt_text'),
        );

        return response()->json(['data' => [
            'id' => $upload->id,
            'purpose' => $upload->purpose,
            'url' => '/api/v1/product-description-assets/'.$upload->id,
            'preview_url' => '/api/v1/seller/product-uploads/'.$upload->id,
            'width' => $upload->width,
            'height' => $upload->height,
            'expires_at' => $upload->expires_at,
        ]], 201);
    }

    public function show(Request $request, ProductUpload $productUpload, SellerShopService $shops): StreamedResponse
    {
        /** @var User $seller */ $seller = $request->user();
        $shop = $shops->for($seller);
        abort_unless($productUpload->shop_id === $shop->id && $productUpload->seller_id === $seller->id && $productUpload->expires_at->isFuture(), 404);

        return Storage::disk($productUpload->disk)->response($productUpload->path, null, [
            'Content-Type' => $productUpload->mime_type,
            'Cache-Control' => 'private, max-age=300',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function description(Request $request, ProductDescriptionAsset $asset, SellerShopService $shops): StreamedResponse
    {
        /** @var User $seller */ $seller = $request->user();
        $shop = $shops->for($seller);
        abort_unless($asset->shop_id === $shop->id && $asset->scan_status === 'approved', 404);

        return Storage::disk($asset->disk)->response($asset->path, null, [
            'Content-Type' => $asset->mime_type,
            'Cache-Control' => 'private, max-age=300',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function media(Request $request, ProductMedia $media, SellerShopService $shops): StreamedResponse
    {
        /** @var User $seller */
        $seller = $request->user();
        $shop = $shops->for($seller);
        abort_unless($media->product()->where('shop_id', $shop->id)->exists() && $media->scan_status === 'approved' && $media->mime_type !== null, 404);

        return Storage::disk($media->disk)->response($media->path, null, [
            'Content-Type' => $media->mime_type,
            'Cache-Control' => 'private, max-age=300',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
