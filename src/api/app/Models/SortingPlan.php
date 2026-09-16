<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SortingPlan extends Model
{
    use HasUuids;

    protected $fillable = [
        'logistics_organization_id', 'logistics_hub_id', 'created_by_logistics_id', 'name', 'is_active', 'revision',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'revision' => 'integer'];
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

    public function lanes(): HasMany
    {
        return $this->hasMany(SortingPlanLane::class)->orderBy('position')->orderBy('postal_code');
    }
}
