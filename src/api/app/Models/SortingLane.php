<?php

namespace App\Models;

use App\Enums\Logistics\SortingLaneType;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SortingLane extends Model
{
    use HasUuids;

    protected $fillable = [
        'logistics_organization_id', 'logistics_hub_id', 'created_by_logistics_id', 'code', 'name',
        'type', 'is_active', 'position', 'revision',
    ];

    protected function casts(): array
    {
        return ['type' => SortingLaneType::class, 'is_active' => 'boolean', 'position' => 'integer', 'revision' => 'integer'];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(LogisticsOrganization::class, 'logistics_organization_id');
    }

    public function hub(): BelongsTo
    {
        return $this->belongsTo(LogisticsHub::class, 'logistics_hub_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(SortingSessionItem::class);
    }

    public function planLanes(): HasMany
    {
        return $this->hasMany(SortingPlanLane::class, 'sorting_lane_id');
    }
}
