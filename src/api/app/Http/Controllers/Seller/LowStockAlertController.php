<?php

namespace App\Http\Controllers\Seller;

use App\Enums\Seller\LowStockAlertState;
use App\Http\Controllers\Controller;
use App\Models\InventoryBalance;
use App\Models\LowStockAlert;
use App\Models\User;
use App\Services\Seller\SellerShopService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LowStockAlertController extends Controller
{
    public function index(Request $request, SellerShopService $shops): JsonResponse
    {
        $filters = $request->validate([
            'state' => ['nullable', Rule::enum(LowStockAlertState::class)],
            'search' => ['nullable', 'string', 'max:100'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        /** @var User $seller */
        $seller = $request->user();
        $shop = $shops->for($seller);
        $search = trim((string) ($filters['search'] ?? ''));

        $alerts = LowStockAlert::query()
            ->where('seller_id', $seller->id)
            ->where('shop_id', $shop->id)
            ->with(['sku.product:id,name,status', 'sku.variant:id,product_id,sku', 'triggerMovement:id,movement_type,reference_type,reference_id'])
            ->when($filters['state'] ?? null, fn ($query, $state) => $query->where('state', $state))
            ->when($search !== '', fn ($query) => $query->whereHas('sku', fn ($skus) => $skus
                ->whereRaw('LOWER(code) LIKE ?', ['%'.strtolower($search).'%'])
                ->orWhereHas('product', fn ($products) => $products->whereRaw('LOWER(name) LIKE ?', ['%'.strtolower($search).'%']))))
            ->when($filters['from'] ?? null, fn ($query, $from) => $query->whereDate('triggered_at', '>=', $from))
            ->when($filters['to'] ?? null, fn ($query, $to) => $query->whereDate('triggered_at', '<=', $to))
            ->orderByDesc('triggered_at')
            ->paginate((int) ($filters['per_page'] ?? 20))
            ->withQueryString();
        $alerts->through(fn (LowStockAlert $alert) => $this->payload($alert));

        $configuredThresholdCount = InventoryBalance::query()
            ->whereNotNull('alert_threshold')
            ->whereHas('sku', fn ($query) => $query->where('shop_id', $shop->id))
            ->count();

        return response()->json([
            ...$alerts->toArray(),
            'configured_threshold_count' => $configuredThresholdCount,
        ]);
    }

    public function show(Request $request, LowStockAlert $alert, SellerShopService $shops): JsonResponse
    {
        /** @var User $seller */
        $seller = $request->user();
        $shop = $shops->for($seller);
        abort_unless($alert->seller_id === $seller->id && $alert->shop_id === $shop->id, 404);
        $alert->load(['sku.product:id,name,status', 'sku.variant:id,product_id,sku', 'triggerMovement:id,movement_type,reference_type,reference_id']);

        return response()->json(['data' => $this->payload($alert)]);
    }

    private function payload(LowStockAlert $alert): array
    {
        return [
            'id' => $alert->id,
            'state' => $alert->state->value,
            'alert_type' => $alert->current_available === 0 ? 'out_of_stock' : 'low_stock',
            'product' => [
                'id' => $alert->sku->product->id,
                'name' => $alert->sku->product->name,
                'status' => $alert->sku->product->status->value,
            ],
            'sku' => [
                'id' => $alert->sku->id,
                'code' => $alert->sku->code,
                'variant' => $alert->sku->variant ? ['id' => $alert->sku->variant->id, 'sku' => $alert->sku->variant->sku] : null,
            ],
            'trigger_threshold' => $alert->trigger_threshold,
            'trigger_available' => $alert->trigger_available,
            'current_threshold' => $alert->current_threshold,
            'current_available' => $alert->current_available,
            'triggered_at' => $alert->triggered_at->toISOString(),
            'resolved_at' => $alert->resolved_at?->toISOString(),
            'resolution_reason' => $alert->resolution_reason?->value,
            'trigger_movement' => $alert->triggerMovement ? [
                'id' => $alert->triggerMovement->id,
                'type' => $alert->triggerMovement->movement_type->value,
                'reference_type' => $alert->triggerMovement->reference_type,
                'reference_id' => $alert->triggerMovement->reference_id,
            ] : null,
            'inventory_destination' => '/inventory/'.$alert->inventory_sku_id,
        ];
    }
}
