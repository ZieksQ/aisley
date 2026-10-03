<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreCommissionPolicyRequest;
use App\Http\Resources\Admin\CommissionPolicyResource;
use App\Models\CommissionPolicy;
use App\Models\ShippingRateVersion;
use App\Services\Finance\CommissionPolicyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class FinanceConfigurationController extends Controller
{
    public function rates(): JsonResponse
    {
        return response()->json(['data' => ShippingRateVersion::query()
            ->with('regionSurcharges')
            ->withCount(['acceptances' => fn ($query) => $query->whereNull('revoked_at')])
            ->latest('version_number')->get()]);
    }

    public function storeRate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'currency' => ['sometimes', Rule::in(['PHP'])],
            'base_fee_cents' => ['required', 'integer', 'min:0'],
            'volumetric_divisor' => ['required', 'integer', 'min:1'], 'max_weight_grams' => ['required', 'integer', 'min:1'],
            'max_length_mm' => ['required', 'integer', 'min:1'], 'max_width_mm' => ['required', 'integer', 'min:1'],
            'max_height_mm' => ['required', 'integer', 'min:1'],
            'region_surcharges' => ['sometimes', 'array', 'max:50'],
            'region_surcharges.*.region' => ['required', 'string', 'max:255'],
            'region_surcharges.*.surcharge_cents' => ['required', 'integer', 'min:0'],
            'effective_at' => ['required', 'date'],
        ]);
        $rate = DB::transaction(function () use ($data): ShippingRateVersion {
            $version = ((int) ShippingRateVersion::query()->lockForUpdate()->max('version_number')) + 1;
            $regions = collect($data['region_surcharges'] ?? []);
            if ($regions->map(fn (array $item) => mb_strtolower(trim($item['region'])))->unique()->count() !== $regions->count()) {
                abort(422, 'Each destination region may appear only once.');
            }
            unset($data['region_surcharges']);
            $rate = ShippingRateVersion::create([
                ...$data,
                'included_weight_grams' => 1,
                'additional_weight_grams' => 1,
                'additional_fee_cents' => 0,
                'destination_surcharge_cents' => 0,
                'version_number' => $version,
                'status' => 'draft',
                'currency' => $data['currency'] ?? 'PHP',
            ]);
            $rate->regionSurcharges()->createMany($regions->map(fn (array $item) => [
                'destination_region' => trim($item['region']),
                'normalized_region' => mb_strtolower(trim($item['region'])),
                'surcharge_cents' => $item['surcharge_cents'],
            ])->all());

            return $rate->load('regionSurcharges');
        });

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
