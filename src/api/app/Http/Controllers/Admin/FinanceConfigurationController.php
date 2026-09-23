<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CommissionPolicy;
use App\Models\ShippingRateVersion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class FinanceConfigurationController extends Controller
{
    public function rates(): JsonResponse
    {
        return response()->json(['data' => ShippingRateVersion::query()->withCount(['acceptances' => fn ($query) => $query->whereNull('revoked_at')])->latest('version_number')->get()]);
    }

    public function storeRate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'currency' => ['sometimes', Rule::in(['PHP'])],
            'origin_region' => ['nullable', 'string', 'max:255'], 'origin_province' => ['nullable', 'string', 'max:255'],
            'origin_city_municipality' => ['nullable', 'string', 'max:255'], 'origin_barangay' => ['nullable', 'string', 'max:255'],
            'destination_region' => ['nullable', 'string', 'max:255'], 'destination_province' => ['nullable', 'string', 'max:255'],
            'destination_city_municipality' => ['nullable', 'string', 'max:255'], 'destination_barangay' => ['nullable', 'string', 'max:255'],
            'base_fee_cents' => ['required', 'integer', 'min:0'], 'included_weight_grams' => ['required', 'integer', 'min:1'],
            'additional_weight_grams' => ['required', 'integer', 'min:1'], 'additional_fee_cents' => ['required', 'integer', 'min:0'],
            'volumetric_divisor' => ['required', 'integer', 'min:1'], 'max_weight_grams' => ['required', 'integer', 'min:1'],
            'max_length_mm' => ['required', 'integer', 'min:1'], 'max_width_mm' => ['required', 'integer', 'min:1'],
            'max_height_mm' => ['required', 'integer', 'min:1'], 'destination_surcharge_cents' => ['sometimes', 'integer', 'min:0'],
            'effective_at' => ['required', 'date'],
        ]);
        $rate = DB::transaction(function () use ($data): ShippingRateVersion {
            $version = ((int) ShippingRateVersion::query()->lockForUpdate()->max('version_number')) + 1;

            return ShippingRateVersion::create([...$data, 'version_number' => $version, 'status' => 'draft', 'currency' => $data['currency'] ?? 'PHP']);
        });

        return response()->json(['data' => $rate], 201);
    }

    public function publishRate(Request $request, string $rate): JsonResponse
    {
        $record = DB::transaction(function () use ($request, $rate): ShippingRateVersion {
            $record = ShippingRateVersion::query()->whereKey($rate)->lockForUpdate()->firstOrFail();
            abort_if($record->status !== 'draft', 409, 'Only draft shipping rates can be published.');
            $record->update(['status' => 'published', 'published_at' => now(), 'published_by_admin_id' => $request->user()->id, 'revision' => $record->revision + 1]);

            return $record->refresh();
        });

        return response()->json(['data' => $record]);
    }

    public function policies(): JsonResponse
    {
        return response()->json(['data' => CommissionPolicy::query()->latest('effective_at')->latest('revision')->get()]);
    }

    public function storePolicy(Request $request): JsonResponse
    {
        $data = $request->validate([
            'beneficiary_type' => ['required', Rule::in(['seller', 'logistics'])],
            'rate_basis_points' => ['required', 'integer', 'between:0,10000'],
            'effective_at' => ['required', 'date'],
        ]);
        $policy = CommissionPolicy::create([...$data, 'status' => 'draft']);

        return response()->json(['data' => $policy], 201);
    }

    public function publishPolicy(Request $request, string $policy): JsonResponse
    {
        $record = DB::transaction(function () use ($request, $policy): CommissionPolicy {
            $record = CommissionPolicy::query()->whereKey($policy)->lockForUpdate()->firstOrFail();
            abort_if($record->status !== 'draft', 409, 'Only draft commission policies can be published.');
            CommissionPolicy::query()->where('beneficiary_type', $record->beneficiary_type)->where('status', 'published')
                ->whereNull('ends_at')->update(['ends_at' => $record->effective_at]);
            $record->update(['status' => 'published', 'published_by_admin_id' => $request->user()->id, 'revision' => $record->revision + 1]);

            return $record->refresh();
        });

        return response()->json(['data' => $record]);
    }
}
