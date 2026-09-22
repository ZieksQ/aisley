<?php

namespace App\Models;

use App\Enums\Logistics\CompanyTruckAvailability;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CompanyTruck extends Model
{
    use HasUuids;

    protected $fillable = [
        'logistics_organization_id', 'home_hub_id', 'plate_number', 'make', 'model',
        'max_parcels', 'is_active', 'availability', 'last_confirmed_hub_id', 'revision',
    ];

    protected function casts(): array
    {
        return [
            'max_parcels' => 'integer',
            'is_active' => 'boolean',
            'availability' => CompanyTruckAvailability::class,
            'revision' => 'integer',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(LogisticsOrganization::class, 'logistics_organization_id');
    }

    public function homeHub(): BelongsTo
    {
        return $this->belongsTo(LogisticsHub::class, 'home_hub_id');
    }

    public function lastConfirmedHub(): BelongsTo
    {
        return $this->belongsTo(LogisticsHub::class, 'last_confirmed_hub_id');
    }

    public function trips(): HasMany
    {
        return $this->hasMany(LinehaulTrip::class);
    }
}
