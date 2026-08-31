<?php

namespace App\Http\Controllers;

use App\Enums\PlatformPolicyType;
use App\Enums\PlatformPolicyVersionStatus;
use App\Http\Resources\PlatformAnnouncementResource;
use App\Http\Resources\PlatformPolicyHistoryResource;
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
        $policyType = $this->publicPolicyType($type);
        $policy = PlatformPolicy::query()->where('type', $policyType)->firstOrFail();
        $version = Cache::remember($policy->cacheKey(), 300, fn () => $policy->currentVersion()->where('status', PlatformPolicyVersionStatus::Published)->first());
        abort_unless($version, 404);

        return response()->json([
            'data' => [
                'type' => $policyType->value,
                'label' => $policyType->label(),
                'version' => (new PlatformPolicyResource($version))->resolve(),
            ],
        ]);
    }

    public function policyHistory(string $type): JsonResponse
    {
        $policyType = $this->publicPolicyType($type);
        $policy = PlatformPolicy::query()->where('type', $policyType)->firstOrFail();
        $versions = $policy->versions()
            ->whereIn('status', [PlatformPolicyVersionStatus::Published, PlatformPolicyVersionStatus::Superseded])
            ->get();

        return response()->json([
            'data' => [
                'type' => $policyType->value,
                'label' => $policyType->label(),
                'versions' => PlatformPolicyHistoryResource::collection($versions)->resolve(),
            ],
        ]);
    }

    public function policyHistoryVersion(string $type, int $version): JsonResponse
    {
        $policyType = $this->publicPolicyType($type);
        $policy = PlatformPolicy::query()->where('type', $policyType)->firstOrFail();
        $policyVersion = $policy->versions()
            ->where('version', $version)
            ->whereIn('status', [PlatformPolicyVersionStatus::Published, PlatformPolicyVersionStatus::Superseded])
            ->firstOrFail();

        return response()->json([
            'data' => [
                'type' => $policyType->value,
                'label' => $policyType->label(),
                'version' => (new PlatformPolicyResource($policyVersion))->resolve(),
            ],
        ]);
    }

    private function publicPolicyType(string $value): PlatformPolicyType
    {
        $type = PlatformPolicyType::tryFrom($value);
        abort_unless(in_array($type, [PlatformPolicyType::TermsOfService, PlatformPolicyType::PrivacyPolicy], true), 404);

        return $type;
    }
}
