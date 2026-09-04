<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\PublishPlatformContentRequest;
use App\Http\Requests\Admin\StoreHomepageAdvertisementRequest;
use App\Http\Requests\Admin\UpdateHomepageAdvertisementRequest;
use App\Http\Resources\Admin\HomepageAdvertisementConfigurationResource;
use App\Models\HomepageAdvertisementConfiguration;
use App\Models\User;
use App\Services\Admin\HomepageAdvertisementService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class HomepageAdvertisementController extends Controller
{
    public function __construct(private readonly HomepageAdvertisementService $advertisements) {}
    public function index(): AnonymousResourceCollection { return HomepageAdvertisementConfigurationResource::collection(HomepageAdvertisementConfiguration::query()->with('campaigns')->latest()->paginate(20)); }
    public function store(StoreHomepageAdvertisementRequest $request): HomepageAdvertisementConfigurationResource { return new HomepageAdvertisementConfigurationResource($this->advertisements->create($this->admin($request), $request->validated(), $this->context($request))->load('campaigns')); }
    public function update(UpdateHomepageAdvertisementRequest $request, HomepageAdvertisementConfiguration $configuration): HomepageAdvertisementConfigurationResource { return new HomepageAdvertisementConfigurationResource($this->advertisements->update($this->admin($request), $configuration, $request->validated(), $this->context($request))->load('campaigns')); }
    public function publish(PublishPlatformContentRequest $request, HomepageAdvertisementConfiguration $configuration): HomepageAdvertisementConfigurationResource { return new HomepageAdvertisementConfigurationResource($this->advertisements->publish($this->admin($request), $configuration, (int) $request->input('revision'), $this->context($request))->load('campaigns')); }
    public function successor(Request $request, HomepageAdvertisementConfiguration $configuration): HomepageAdvertisementConfigurationResource { return new HomepageAdvertisementConfigurationResource($this->advertisements->successor($this->admin($request), $configuration, $this->context($request))->load('campaigns')); }
    private function admin(Request $request): User { return $request->user(); }
    private function context(Request $request): array { return ['ip_address' => $request->ip(), 'user_agent' => $request->userAgent(), 'request_id' => $request->header('X-Request-ID')]; }
}
