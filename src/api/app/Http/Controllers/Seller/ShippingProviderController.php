<?php

namespace App\Http\Controllers\Seller;

use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Seller\ConfigureLogisticsProviderRequest;
use App\Models\LogisticsOrganization;
use App\Models\ShopLogisticsProvider;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ShippingProviderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $shop = $request->user()->shop()->firstOrFail();
        $configured = ShopLogisticsProvider::query()->where('shop_id', $shop->id)->get()->keyBy('logistics_organization_id');
        $providers = LogisticsOrganization::query()
            ->whereHas('user', fn ($query) => $query->where('status', UserStatus::Active))
            ->whereHas('hub')
            ->with('hub:id,logistics_organization_id,name')
            ->orderBy('business_name')->get()
            ->map(function (LogisticsOrganization $organization) use ($configured): array {
                $setting = $configured->get($organization->id);

                return [
                    'organization_id' => $organization->id,
                    'business_name' => $organization->business_name,
                    'hub' => ['id' => $organization->hub->id, 'name' => $organization->hub->name],
                    'is_enabled' => (bool) ($setting?->is_enabled ?? false),
                    'revision' => $setting?->revision,
                ];
            });

        return response()->json(['data' => $providers])->header('Cache-Control', 'private, no-store');
    }

    public function update(ConfigureLogisticsProviderRequest $request, string $organization): JsonResponse
    {
        $shop = $request->user()->shop()->firstOrFail();
        $provider = LogisticsOrganization::query()->whereKey($organization)
            ->whereHas('user', fn ($query) => $query->where('status', UserStatus::Active))
            ->whereHas('hub')->firstOrFail();
        $data = $request->validated();

        $setting = DB::transaction(function () use ($request, $shop, $provider, $data): ShopLogisticsProvider {
            $setting = ShopLogisticsProvider::query()->where('shop_id', $shop->id)
                ->where('logistics_organization_id', $provider->id)->lockForUpdate()->first();
            if ($setting !== null && isset($data['expected_revision']) && $setting->revision !== (int) $data['expected_revision']) {
                abort(409, 'The shipping provider setting changed. Refresh and try again.');
            }
            if ($setting === null) {
                return ShopLogisticsProvider::create([
                    'shop_id' => $shop->id,
                    'logistics_organization_id' => $provider->id,
                    'is_enabled' => $data['is_enabled'],
                    'configured_by' => $request->user()->id,
                ]);
            }
            $setting->update([
                'is_enabled' => $data['is_enabled'],
                'configured_by' => $request->user()->id,
                'revision' => $setting->revision + 1,
            ]);

            return $setting->refresh();
        });

        return response()->json(['data' => $setting]);
    }
}
