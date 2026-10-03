<?php

namespace App\Http\Controllers\Logistics;

use App\Enums\CategoryStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\StoreRateCardRequest;
use App\Models\LogisticsRateCard;
use App\Models\ShopCategory;
use App\Services\Logistics\RateCardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RateCardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $organization = $request->user()->logisticsOrganization()->firstOrFail();

        $cards = LogisticsRateCard::query()
            ->where('logistics_organization_id', $organization->id)
            ->with(['rules.category:id,name,shop_category_id', 'rules.shopCategory:id,name', 'services'])
            ->latest('version_number')
            ->get();
        $shopCategories = ShopCategory::query()
            ->where('status', CategoryStatus::Active)
            ->orderBy('position')
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (ShopCategory $shopCategory): array => [
                'id' => $shopCategory->id,
                'name' => $shopCategory->name,
            ]);

        return response()->json([
            'data' => $cards,
            'meta' => ['shop_categories' => $shopCategories],
        ])->header('Cache-Control', 'private, no-store');
    }

    public function store(StoreRateCardRequest $request, RateCardService $service): JsonResponse
    {
        $organization = $request->user()->logisticsOrganization()->firstOrFail();
        $card = $service->create($organization, $request->validated());

        return response()->json(['data' => $card], 201);
    }

    public function publish(Request $request, string $card, RateCardService $service): JsonResponse
    {
        $organization = $request->user()->logisticsOrganization()->firstOrFail();
        $record = $service->publish($organization, $card, $request->user()->id);

        return response()->json(['data' => $record]);
    }
}
