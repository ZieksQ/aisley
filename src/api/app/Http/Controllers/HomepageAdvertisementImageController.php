<?php

namespace App\Http\Controllers;

use App\Enums\HomepageAdvertisementStatus;
use App\Models\HomepageCampaign;
use App\Services\Admin\HomepageAdvertisementImageService;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class HomepageAdvertisementImageController extends Controller
{
    public function __invoke(HomepageCampaign $campaign, string $variant): StreamedResponse
    {
        $configuration = $campaign->advertisementConfiguration;
        abort_unless(
            $configuration
            && $configuration->status === HomepageAdvertisementStatus::Published
            && $campaign->is_active
            && (! $configuration->starts_at || $configuration->starts_at->lte(now()))
            && (! $configuration->ends_at || $configuration->ends_at->gt(now())),
            404,
        );

        $path = HomepageAdvertisementImageService::storagePath(
            $campaign->image_disk,
            $variant === 'desktop' ? $campaign->image_desktop_path : $campaign->image_mobile_path,
        );
        abort_if($path === null, 404);

        $storage = Storage::disk($campaign->image_disk ?: 'public');
        abort_unless($storage->exists($path), 404);

        return $storage->response($path, null, [
            'Content-Type' => $this->contentType($path),
            'Cache-Control' => 'public, max-age=86400',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function contentType(string $path): string
    {
        return match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
            'jpg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'webp' => 'image/webp',
            default => 'application/octet-stream',
        };
    }
}
