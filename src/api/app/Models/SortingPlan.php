<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SortingPlan extends Model
{
    use HasUuids;

    protected $attributes = ['draft_dirty' => true];

    protected $fillable = [
        'logistics_organization_id', 'logistics_hub_id', 'created_by_logistics_id', 'name', 'is_active', 'revision', 'active_version_id', 'draft_dirty', 'archived_at',
    ];

    protected function casts(): array
    {
        return ['draft_dirty' => 'boolean', 'archived_at' => 'immutable_datetime', 'is_active' => 'boolean', 'revision' => 'integer'];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(LogisticsOrganization::class, 'logistics_organization_id');
    }

    public function hub(): BelongsTo
    {
        return $this->belongsTo(LogisticsHub::class, 'logistics_hub_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_logistics_id');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(SortingPlanVersion::class)->orderByDesc('number');
    }

    public function activeVersion(): BelongsTo
    {
        return $this->belongsTo(SortingPlanVersion::class, 'active_version_id');
    }

    public function lanes(): HasMany
    {
        return $this->hasMany(SortingPlanLane::class)->orderBy('position')->orderBy('postal_code');
    }
}
