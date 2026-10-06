<?php

namespace App\Services\Logistics\Sorting;

use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\SortingPlan;
use App\Models\SortingPlanVersion;
use App\Models\User;

class SortingPlanCopyService
{
    /** Called under the shared hub lock and mutation replay transaction. */
    public function copy(User $actor, SortingPlan $source, ?SortingPlanVersion $version, ?string $name): SortingPlan
    {
        $names = SortingPlan::query()->where('logistics_hub_id', $source->logistics_hub_id)->pluck('name');
        $name = $name === null ? $this->nextName($source->name, $names->all()) : trim($name);
        if ($names->contains(fn ($existing) => mb_strtolower($existing) === mb_strtolower($name))) {
            throw FulfillmentException::invalid('SORT_PLAN_NAME_TAKEN', 'A plan already uses this name.', 'name');
        }

        $copy = SortingPlan::create([
            'logistics_organization_id' => $source->logistics_organization_id,
            'logistics_hub_id' => $source->logistics_hub_id,
            'created_by_logistics_id' => $actor->id,
            'name' => $name,
            'is_active' => false,
            'revision' => 1,
            'draft_dirty' => true,
        ]);
        $mappings = $version?->mappings ?? $source->lanes->map(fn ($mapping) => [
            ...$mapping->only(['sorting_lane_id', 'destination_hub_id', 'postal_code', 'position']),
            'destination_type' => $mapping->destination_type->value,
        ])->all();
        foreach ($mappings as $mapping) {
            unset($mapping['id']);
            $copy->lanes()->create($mapping);
        }

        return $copy;
    }

    private function nextName(string $sourceName, array $names): string
    {
        $base = preg_replace('/\s+\(\d+\)$/u', '', $sourceName);
        $number = 1;
        // Recheck the shortened base as the suffix grows, keeping the 80-character limit.
        do {
            $suffix = ' ('.$number.')';
            $root = rtrim(mb_substr($base, 0, 80 - mb_strlen($suffix)));
            $pattern = '/^'.preg_quote($root, '/').' \((\d+)\)$/iu';
            $highest = 0;
            foreach ($names as $existing) {
                if (preg_match($pattern, $existing, $match)) {
                    $highest = max($highest, (int) $match[1]);
                }
            }
            $next = max($number, $highest + 1);
            if ($next === $number) {
                return $root.$suffix;
            }
            $number = $next;
        } while (true);
    }
}
