<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LogisticsHub extends Model
{
    use HasUuids;

    protected $fillable = ['logistics_organization_id', 'address_id', 'name', 'location_revision'];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(LogisticsOrganization::class, 'logistics_organization_id');
    }

    public function address(): BelongsTo
    {
        return $this->belongsTo(Address::class);
    }

    public function locationChanges(): HasMany
    {
        return $this->hasMany(LogisticsHubLocationChange::class, 'logistics_hub_id');
    }
}
