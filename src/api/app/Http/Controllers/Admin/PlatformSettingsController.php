<?php

namespace App\Http\Controllers\Admin;

use App\Enums\PlatformPolicyType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\CreatePolicySuccessorRequest;
use App\Http\Requests\Admin\PublishPlatformContentRequest;
use App\Http\Requests\Admin\StoreAnnouncementRequest;
use App\Http\Requests\Admin\StorePolicyVersionRequest;
use App\Http\Requests\Admin\UpdateAnnouncementRequest;
use App\Http\Requests\Admin\UpdatePolicyVersionRequest;
use App\Http\Resources\Admin\AnnouncementResource;
use App\Http\Resources\Admin\PlatformPolicyVersionResource;
use App\Models\Announcement;
use App\Models\PlatformPolicy;
use App\Models\PlatformPolicyVersion;
use App\Models\User;
use App\Services\Admin\PlatformSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PlatformSettingsController extends Controller
{
    public function __construct(private readonly PlatformSettingsService $settings) {}

    public function announcements(Request $request): AnonymousResourceCollection
    {
        return AnnouncementResource::collection(
            Announcement::query()->with(['creator:id,email', 'updater:id,email'])
                ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->value()))
                ->latest()->paginate(20)->withQueryString(),
        );
    }

    public function storeAnnouncement(StoreAnnouncementRequest $request): AnnouncementResource
    {
        return new AnnouncementResource($this->settings->createAnnouncement($this->admin($request), $request->validated(), $this->context($request))->load(['creator:id,email', 'updater:id,email']));
    }

    public function updateAnnouncement(UpdateAnnouncementRequest $request, Announcement $announcement): AnnouncementResource
    {
        return new AnnouncementResource($this->settings->updateAnnouncement($this->admin($request), $announcement, $request->validated(), $this->context($request))->load(['creator:id,email', 'updater:id,email']));
    }

    public function publishAnnouncement(PublishPlatformContentRequest $request, Announcement $announcement): AnnouncementResource
    {
        return new AnnouncementResource($this->settings->publishAnnouncement($this->admin($request), $announcement, (int) $request->input('revision'), $this->context($request))->load(['creator:id,email', 'updater:id,email']));
    }

    public function archiveAnnouncement(PublishPlatformContentRequest $request, Announcement $announcement): AnnouncementResource
    {
        return new AnnouncementResource($this->settings->archiveAnnouncement($this->admin($request), $announcement, (int) $request->input('revision'), $this->context($request))->load(['creator:id,email', 'updater:id,email']));
    }

    public function policies(): JsonResponse
    {
        $policies = PlatformPolicy::query()->with(['currentVersion.creator:id,email', 'versions.creator:id,email'])->get()->keyBy(fn (PlatformPolicy $policy) => $policy->type->value);

        return response()->json(['data' => collect(PlatformPolicyType::cases())->map(function (PlatformPolicyType $type) use ($policies) {
            /** @var PlatformPolicy|null $policy */
            $policy = $policies->get($type->value);

            return [
                'id' => $policy?->id,
                'type' => $type->value,
                'label' => $type->label(),
                'current_version_id' => $policy?->current_version_id,
                'versions' => $policy ? PlatformPolicyVersionResource::collection($policy->versions)->resolve() : [],
            ];
        })->values()]);
    }

    public function storePolicyVersion(StorePolicyVersionRequest $request, string $type): PlatformPolicyVersionResource
    {
        $policyType = $this->policyType($type);

        return new PlatformPolicyVersionResource($this->settings->createPolicyVersion($this->admin($request), $policyType, $request->validated(), $this->context($request))->load('creator:id,email'));
    }

    public function updatePolicyVersion(UpdatePolicyVersionRequest $request, PlatformPolicyVersion $version): PlatformPolicyVersionResource
    {
        return new PlatformPolicyVersionResource($this->settings->updatePolicyVersion($this->admin($request), $version, $request->validated(), $this->context($request))->load('creator:id,email'));
    }

    public function createPolicySuccessor(CreatePolicySuccessorRequest $request, PlatformPolicyVersion $version): PlatformPolicyVersionResource
    {
        return new PlatformPolicyVersionResource($this->settings->createPolicySuccessor(
            $this->admin($request),
            $version,
            $request->validated('change_summary'),
            $this->context($request),
        )->load('creator:id,email'));
    }

    public function publishPolicyVersion(PublishPlatformContentRequest $request, PlatformPolicyVersion $version): PlatformPolicyVersionResource
    {
        return new PlatformPolicyVersionResource($this->settings->publishPolicyVersion($this->admin($request), $version, (int) $request->input('revision'), $this->context($request))->load('creator:id,email'));
    }

    private function policyType(string $value): PlatformPolicyType
    {
        $type = PlatformPolicyType::tryFrom($value);
        abort_unless($type, 404);

        return $type;
    }

    private function admin(Request $request): User
    {
        /** @var User $admin */ $admin = $request->user();

        return $admin;
    }

    private function context(Request $request): array
    {
        return ['ip_address' => $request->ip(), 'user_agent' => $request->userAgent(), 'request_id' => $request->header('X-Request-ID')];
    }
}
