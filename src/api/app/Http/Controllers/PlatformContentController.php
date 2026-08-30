<?php

namespace App\Http\Controllers;

use App\Enums\PlatformPolicyType;
use App\Http\Resources\PlatformAnnouncementResource;
use App\Http\Resources\PlatformPolicyResource;
use App\Models\Announcement;
use App\Models\PlatformPolicy;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class PlatformContentController extends Controller
{
    public function announcements(): JsonResponse
    {
        $announcements = Cache::remember(Announcement::ACTIVE_CACHE_KEY, 60, fn () => Announcement::active()->latest('published_at')->get());
        $visible = $announcements->filter(fn (Announcement $announcement) => ! $announcement->expires_at || $announcement->expires_at->isFuture())->values();

        return response()->json(['data' => PlatformAnnouncementResource::collection($visible)->resolve()]);
    }

    public function policy(string $type): JsonResponse
    {
        $policyType = PlatformPolicyType::tryFrom($type);
        abort_unless($policyType, 404);
        $policy = PlatformPolicy::query()->where('type', $policyType)->firstOrFail();
        $version = Cache::remember($policy->cacheKey(), 300, fn () => $policy->currentVersion()->first());
        abort_unless($version, 404);

        return response()->json([
            'data' => [
                'type' => $policyType->value,
                'label' => $policyType->label(),
                'version' => (new PlatformPolicyResource($version))->resolve(),
            ],
        ]);
    }
}
