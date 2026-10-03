<?php

namespace App\Services\Logistics;

use App\Enums\LogisticsRateCardStatus;
use App\Models\LogisticsOrganization;
use App\Models\LogisticsRateCard;
use Illuminate\Support\Facades\DB;

class RateCardService
{
    /** @param array<string, mixed> $data */
    public function create(LogisticsOrganization $organization, array $data): LogisticsRateCard
    {
        return DB::transaction(function () use ($organization, $data): LogisticsRateCard {
            $organization->newQuery()->whereKey($organization->id)->lockForUpdate()->firstOrFail();
            $version = ((int) LogisticsRateCard::query()
                ->where('logistics_organization_id', $organization->id)->max('version_number')) + 1;
            $card = LogisticsRateCard::create([
                'logistics_organization_id' => $organization->id,
                'version_number' => $version,
                'status' => LogisticsRateCardStatus::Draft,
                'currency' => $data['currency'] ?? 'PHP',
                'effective_at' => $data['effective_at'],
            ]);
            $card->services()->createMany($data['services']);
            $card->rules()->createMany(array_map(fn (array $rule) => [...$rule, 'base_charge_cents' => 0], $data['rules']));

            return $card->load(['rules.category:id,name', 'services']);
        });
    }

    public function publish(LogisticsOrganization $organization, string $cardId, string $publisherId): LogisticsRateCard
    {
        return DB::transaction(function () use ($organization, $cardId, $publisherId): LogisticsRateCard {
            $organization->newQuery()->whereKey($organization->id)->lockForUpdate()->firstOrFail();
            $card = LogisticsRateCard::query()->whereKey($cardId)
                ->where('logistics_organization_id', $organization->id)
                ->with(['rules', 'services'])->lockForUpdate()->firstOrFail();
            abort_if($card->status !== LogisticsRateCardStatus::Draft, 409, 'Only a draft rate card can be published.');
            abort_if($card->rules->isEmpty(), 409, 'Add at least one rate rule before publishing.');
            $services = $card->services->pluck('service_type')->map(fn ($type) => $type->value)->sort()->values()->all();
            $ruleTypes = $card->rules->pluck('service_type')->map(fn ($type) => $type->value)->unique()->sort()->values()->all();
            abort_if($services !== $ruleTypes, 409, 'Every offered service needs a base fee and category coverage.');
            LogisticsRateCard::query()->where('logistics_organization_id', $organization->id)
                ->where('status', LogisticsRateCardStatus::Published->value)
                ->update(['status' => LogisticsRateCardStatus::Archived->value]);
            $card->update([
                'status' => LogisticsRateCardStatus::Published,
                'published_at' => now(),
                'published_by' => $publisherId,
                'revision' => $card->revision + 1,
            ]);

            return $card->fresh(['rules.category:id,name', 'services']);
        });
    }
}
