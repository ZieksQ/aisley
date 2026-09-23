<?php

namespace App\Http\Controllers\Logistics;

use App\Http\Controllers\Controller;
use App\Models\LogisticsShippingRateAcceptance;
use App\Models\ShippingRateVersion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ShippingRateController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $organization = $request->user()->logisticsOrganization()->firstOrFail();
        $rates = ShippingRateVersion::query()->where('status', 'published')->orderByDesc('version_number')->get()
            ->map(function (ShippingRateVersion $rate) use ($organization): array {
                $acceptance = LogisticsShippingRateAcceptance::query()->where('shipping_rate_version_id', $rate->id)
                    ->where('logistics_organization_id', $organization->id)->first();

                return ['rate' => $rate, 'accepted' => $acceptance?->revoked_at === null && $acceptance !== null, 'accepted_at' => $acceptance?->accepted_at?->toISOString()];
            });

        return response()->json(['data' => $rates])->header('Cache-Control', 'private, no-store');
    }

    public function accept(Request $request, string $rate): JsonResponse
    {
        $organization = $request->user()->logisticsOrganization()->firstOrFail();
        $record = DB::transaction(function () use ($request, $rate, $organization): LogisticsShippingRateAcceptance {
            $shippingRate = ShippingRateVersion::query()->whereKey($rate)->where('status', 'published')->lockForUpdate()->firstOrFail();

            return LogisticsShippingRateAcceptance::query()->updateOrCreate(
                ['shipping_rate_version_id' => $shippingRate->id, 'logistics_organization_id' => $organization->id],
                ['accepted_by' => $request->user()->id, 'accepted_at' => now(), 'revoked_at' => null],
            );
        });

        return response()->json(['data' => $record]);
    }
}
