<?php

namespace App\Http\Controllers\Logistics;

use App\Enums\CategoryStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\StoreRateCardRequest;
use App\Models\Category;
use App\Models\LogisticsRateCard;
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
            ->with(['rules.category:id,name,shop_category_id', 'services'])
            ->latest('version_number')
            ->get();
        $categories = Category::query()
            ->where('status', CategoryStatus::Active)
            ->with('shopCategory:id,name')
            ->orderBy('shop_category_id')
            ->orderBy('position')
            ->orderBy('name')
            ->get(['id', 'shop_category_id', 'name'])
            ->map(fn (Category $category): array => [
                'id' => $category->id,
                'name' => $category->name,
                'group_name' => $category->shopCategory?->name,
            ]);

        return response()->json([
            'data' => $cards,
            'meta' => ['categories' => $categories],
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
