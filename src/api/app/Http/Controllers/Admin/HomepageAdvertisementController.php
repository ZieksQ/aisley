<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PublishPlatformContentRequest;
use App\Http\Requests\Admin\StoreHomepageAdvertisementRequest;
use App\Http\Requests\Admin\UpdateHomepageAdvertisementRequest;
use App\Http\Resources\Admin\HomepageAdvertisementConfigurationResource;
use App\Models\HomepageAdvertisementConfiguration;
use App\Models\HomepageCampaign;
use App\Models\User;
use App\Services\Admin\HomepageAdvertisementImageService;
use App\Services\Admin\HomepageAdvertisementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class HomepageAdvertisementController extends Controller
{
    public function __construct(private readonly HomepageAdvertisementService $advertisements) {}

    public function index(): AnonymousResourceCollection
    {
        return HomepageAdvertisementConfigurationResource::collection(HomepageAdvertisementConfiguration::query()->with('campaigns')->latest()->paginate(20));
    }

    public function show(HomepageAdvertisementConfiguration $configuration): HomepageAdvertisementConfigurationResource
    {
        return new HomepageAdvertisementConfigurationResource($configuration->load('campaigns'));
    }

    public function store(StoreHomepageAdvertisementRequest $request): HomepageAdvertisementConfigurationResource
    {
        return new HomepageAdvertisementConfigurationResource($this->advertisements->create($this->admin($request), $request->validated(), $this->context($request))->load('campaigns'));
    }

    public function update(UpdateHomepageAdvertisementRequest $request, HomepageAdvertisementConfiguration $configuration): HomepageAdvertisementConfigurationResource
    {
        return new HomepageAdvertisementConfigurationResource($this->advertisements->update($this->admin($request), $configuration, $request->validated(), $this->context($request))->load('campaigns'));
    }

    public function destroy(PublishPlatformContentRequest $request, HomepageAdvertisementConfiguration $configuration): JsonResponse
    {
        $this->advertisements->destroy($this->admin($request), $configuration, (int) $request->input('revision'), $this->context($request));

        return response()->json([], 204);
    }

    public function publish(PublishPlatformContentRequest $request, HomepageAdvertisementConfiguration $configuration): HomepageAdvertisementConfigurationResource
    {
        return new HomepageAdvertisementConfigurationResource($this->advertisements->publish($this->admin($request), $configuration, (int) $request->input('revision'), $this->context($request))->load('campaigns'));
    }

    public function successor(Request $request, HomepageAdvertisementConfiguration $configuration): HomepageAdvertisementConfigurationResource
    {
        return new HomepageAdvertisementConfigurationResource($this->advertisements->successor($this->admin($request), $configuration, $this->context($request))->load('campaigns'));
    }

    public function upload(Request $request, HomepageAdvertisementImageService $images): JsonResponse
    {
        $request->validate(['image' => ['required', 'file', 'max:10239']]);

        return response()->json(['data' => $images->store($request->file('image'))], 201);
    }

    public function image(HomepageCampaign $campaign, string $variant): Response
    {
        abort_unless($campaign->homepage_advertisement_configuration_id !== null, 404);
        $path = HomepageAdvertisementImageService::storagePath(
            $campaign->image_disk,
            $variant === 'desktop' ? $campaign->image_desktop_path : $campaign->image_mobile_path,
        );
        abort_if($path === null, 404);

        $storage = Storage::disk($campaign->image_disk ?: 'public');
        abort_unless($storage->exists($path), 404);

        return response($storage->get($path), 200, [
            'Content-Type' => match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
                'jpg', 'jpeg' => 'image/jpeg',
                'png' => 'image/png',
                'webp' => 'image/webp',
                default => 'application/octet-stream',
            },
            'Cache-Control' => 'private, no-store',
        ]);
    }

    private function admin(Request $request): User
    {
        return $request->user();
    }

    private function context(Request $request): array
    {
        return ['ip_address' => $request->ip(), 'user_agent' => $request->userAgent(), 'request_id' => $request->header('X-Request-ID')];
    }
}
