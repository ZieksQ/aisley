<?php

namespace App\Models;

use App\Enums\Logistics\SortingDestinationType;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SortingPlanLane extends Model
{
    use HasUuids;

    protected $fillable = ['sorting_plan_id', 'sorting_lane_id', 'destination_type', 'destination_hub_id', 'postal_code', 'position'];

    protected function casts(): array
    {
        return ['destination_type' => SortingDestinationType::class, 'position' => 'integer'];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(SortingPlan::class, 'sorting_plan_id');
    }

    public function lane(): BelongsTo
    {
        return $this->belongsTo(SortingLane::class, 'sorting_lane_id');
    }
}
