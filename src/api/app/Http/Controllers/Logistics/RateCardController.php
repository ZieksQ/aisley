<?php

namespace App\Http\Controllers\Logistics;

use App\Enums\LogisticsRateCardStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\StoreRateCardRequest;
use App\Models\LogisticsRateCard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RateCardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $organization = $request->user()->logisticsOrganization()->firstOrFail();

        return response()->json(['data' => LogisticsRateCard::query()
            ->where('logistics_organization_id', $organization->id)
            ->with('rules.category:id,name')
            ->latest('version_number')
            ->get()])->header('Cache-Control', 'private, no-store');
    }

    public function store(StoreRateCardRequest $request): JsonResponse
    {
        $organization = $request->user()->logisticsOrganization()->firstOrFail();
        $data = $request->validated();
        $duplicates = collect($data['rules'])->map(fn (array $rule) => $rule['category_id'].':'.$rule['service_type']);
        if ($duplicates->unique()->count() !== $duplicates->count()) {
            throw ValidationException::withMessages(['rules' => 'Each category and service type may appear only once.']);
        }

        $card = DB::transaction(function () use ($organization, $data): LogisticsRateCard {
            $version = ((int) LogisticsRateCard::query()
                ->where('logistics_organization_id', $organization->id)
                ->lockForUpdate()->max('version_number')) + 1;
            $card = LogisticsRateCard::create([
                'logistics_organization_id' => $organization->id,
                'version_number' => $version,
                'status' => LogisticsRateCardStatus::Draft,
                'currency' => $data['currency'] ?? 'PHP',
                'effective_at' => $data['effective_at'],
            ]);
            $card->rules()->createMany($data['rules']);

            return $card->load('rules.category:id,name');
        });

        return response()->json(['data' => $card], 201);
    }

    public function publish(Request $request, string $card): JsonResponse
    {
        $organization = $request->user()->logisticsOrganization()->firstOrFail();
        $record = DB::transaction(function () use ($request, $organization, $card): LogisticsRateCard {
            $record = LogisticsRateCard::query()->whereKey($card)
                ->where('logistics_organization_id', $organization->id)
                ->withCount('rules')->lockForUpdate()->firstOrFail();
            abort_if($record->status !== LogisticsRateCardStatus::Draft, 409, 'Only a draft rate card can be published.');
            abort_if($record->rules_count < 1, 409, 'Add at least one rate rule before publishing.');
            LogisticsRateCard::query()->where('logistics_organization_id', $organization->id)
                ->where('status', LogisticsRateCardStatus::Published->value)
                ->update(['status' => LogisticsRateCardStatus::Archived->value]);
            $record->update([
                'status' => LogisticsRateCardStatus::Published,
                'published_at' => now(),
                'published_by' => $request->user()->id,
                'revision' => $record->revision + 1,
            ]);

            return $record->fresh('rules.category:id,name');
        });

        return response()->json(['data' => $record]);
    }
}
