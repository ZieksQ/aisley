<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateFeatureControlRequest;
use App\Http\Resources\Admin\FeatureControlResource;
use App\Models\PlatformFeatureControl;
use App\Models\User;
use App\Services\Admin\PlatformSettingsService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class FeatureControlController extends Controller
{
    public function __construct(private readonly PlatformSettingsService $settings) {}

    public function index(): AnonymousResourceCollection
    {
        return FeatureControlResource::collection(
            PlatformFeatureControl::query()
                ->with('updatedByAdmin:id,email')
                ->orderBy('label')
                ->get(),
        );
    }

    public function update(UpdateFeatureControlRequest $request, string $key): FeatureControlResource
    {
        return new FeatureControlResource(
            $this->settings->updateFeatureControl(
                $this->admin($request),
                $key,
                $request->validated(),
                $this->context($request),
            )->load('updatedByAdmin:id,email'),
        );
    }

    private function admin(Request $request): User
    {
        /** @var User $admin */
        $admin = $request->user();

        return $admin;
    }

    /** @return array<string, string|null> */
    private function context(Request $request): array
    {
        return [
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'request_id' => $request->header('X-Request-ID'),
        ];
    }
}
