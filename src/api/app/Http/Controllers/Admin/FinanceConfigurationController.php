<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreCommissionPolicyRequest;
use App\Http\Requests\Admin\StoreShippingRateRequest;
use App\Http\Resources\Admin\CommissionPolicyResource;
use App\Models\CommissionPolicy;
use App\Models\ShippingRateVersion;
use App\Services\Finance\CommissionPolicyService;
use App\Services\Finance\ShippingTariffService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FinanceConfigurationController extends Controller
{
    public function rates(): JsonResponse
    {
        return response()->json(['data' => ShippingRateVersion::query()
            ->with('regionSurcharges')
            ->withCount(['acceptances' => fn ($query) => $query->whereNull('revoked_at')])
            ->latest('version_number')->get()]);
    }

    public function storeRate(StoreShippingRateRequest $request, ShippingTariffService $service): JsonResponse
    {
        $rate = $service->create($request->validated());

        return response()->json(['data' => $rate], 201);
    }

    public function publishRate(Request $request, string $rate): JsonResponse
    {
        $record = DB::transaction(function () use ($request, $rate): ShippingRateVersion {
            $record = ShippingRateVersion::query()->whereKey($rate)->lockForUpdate()->firstOrFail();
            abort_if($record->status !== 'draft', 409, 'Only draft shipping rates can be published.');
            $record->update(['status' => 'published', 'published_at' => now(), 'published_by_admin_id' => $request->user()->id, 'revision' => $record->revision + 1]);

            return $record->refresh()->load('regionSurcharges');
        });

        return response()->json(['data' => $record]);
    }

    public function policies(): JsonResponse
    {
        return response()->json(['data' => CommissionPolicyResource::collection(
            CommissionPolicy::query()->latest('created_at')->orderByDesc('id')->get()
        )])->header('Cache-Control', 'no-store, private');
    }

    public function storePolicy(StoreCommissionPolicyRequest $request): JsonResponse
    {
        $policy = CommissionPolicy::create([...$request->validated(), 'status' => 'draft']);

        return response()->json(['data' => new CommissionPolicyResource($policy)], 201);
    }

    public function publishPolicy(Request $request, string $policy, CommissionPolicyService $service): JsonResponse
    {
        $record = $service->publish($policy, $request->user()->id);

        return response()->json(['data' => new CommissionPolicyResource($record)]);
    }
}
