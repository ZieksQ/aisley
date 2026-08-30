<?php

namespace App\Http\Controllers\Seller;

use App\Enums\InventoryMovementType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Seller\AdjustInventoryRequest;
use App\Models\InventorySku;
use App\Models\User;
use App\Services\Seller\InventoryService;
use App\Services\Seller\SellerShopService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InventoryController extends Controller
{
    public function index(Request $request, SellerShopService $shops): JsonResponse
    {
        /** @var User $seller */ $seller = $request->user();
        $shop = $shops->for($seller);
        $skus = InventorySku::query()->whereHas('product', fn ($q) => $q->where('shop_id', $shop->id))
            ->with(['product:id,name,status', 'variant:id,product_id,sku', 'balance'])
            ->when($request->string('search')->toString(), fn ($q, $search) => $q->where(fn ($inner) => $inner->whereRaw('LOWER(code) LIKE ?', ['%'.strtolower($search).'%'])->orWhereHas('product', fn ($products) => $products->whereRaw('LOWER(name) LIKE ?', ['%'.strtolower($search).'%']))))
            ->when($request->string('stock')->toString() === 'out', fn ($q) => $q->whereHas('balance', fn ($b) => $b->whereColumn('on_hand', '<=', 'reserved')))
            ->when($request->string('stock')->toString() === 'low', fn ($q) => $q->whereHas('balance', fn ($b) => $b->whereNotNull('alert_threshold')->whereRaw('(on_hand - reserved) <= alert_threshold')->whereColumn('on_hand', '>', 'reserved')))
            ->orderBy('code')->paginate(20)->withQueryString();
        $skus->through(fn ($sku) => $this->payload($sku));

        return response()->json($skus);
    }

    public function show(Request $request, InventorySku $inventorySku, SellerShopService $shops): JsonResponse
    {
        $this->assertOwned($request, $inventorySku, $shops);
        $inventorySku->load(['product:id,name,status', 'variant:id,product_id,sku', 'balance']);

        return response()->json(['data' => $this->payload($inventorySku)]);
    }

    public function movements(Request $request, InventorySku $inventorySku, SellerShopService $shops): JsonResponse
    {
        $this->assertOwned($request, $inventorySku, $shops);

        return response()->json($inventorySku->balance->movements()->with('actor:id,email')->paginate(30));
    }

    public function adjust(AdjustInventoryRequest $request, InventorySku $inventorySku, SellerShopService $shops, InventoryService $inventory): JsonResponse
    {
        $this->assertOwned($request, $inventorySku, $shops);
        $data = $request->validated();
        /** @var User $seller */ $seller = $request->user();
        $movement = $inventory->adjust($inventorySku, $data['quantity'], InventoryMovementType::from($data['movement_type']), $data['reason'], $seller, $data['idempotency_key'] ?? null);

        return response()->json(['data' => $movement, 'inventory' => $this->payload($inventorySku->fresh(['product', 'variant', 'balance']))], 201);
    }

    public function threshold(Request $request, InventorySku $inventorySku, SellerShopService $shops): JsonResponse
    {
        $this->assertOwned($request, $inventorySku, $shops);
        $data = $request->validate(['alert_threshold' => ['nullable', 'integer', 'min:0', 'max:999999999']]);
        $inventorySku->balance()->update($data);

        return response()->json(['data' => $this->payload($inventorySku->fresh(['product', 'variant', 'balance']))]);
    }

    private function assertOwned(Request $request, InventorySku $sku, SellerShopService $shops): void
    {
        /** @var User $seller */ $seller = $request->user();
        abort_unless($sku->product()->where('shop_id', $shops->for($seller)->id)->exists(), 404);
    }

    private function payload(InventorySku $sku): array
    {
        $balance = $sku->balance;
        $available = $balance->available();

        return [
            'id' => $sku->id, 'code' => $sku->code, 'status' => $sku->status->value,
            'product' => ['id' => $sku->product->id, 'name' => $sku->product->name, 'status' => $sku->product->status->value],
            'variant' => $sku->variant ? ['id' => $sku->variant->id, 'sku' => $sku->variant->sku] : null,
            'on_hand' => $balance->on_hand, 'reserved' => $balance->reserved, 'available' => $available,
            'alert_threshold' => $balance->alert_threshold,
            'stock_state' => $available <= 0 ? 'out' : ($balance->alert_threshold !== null && $available <= $balance->alert_threshold ? 'low' : 'in_stock'),
        ];
    }
}
