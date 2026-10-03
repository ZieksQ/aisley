<?php

namespace App\Models;

use App\Enums\LogisticsRateCardStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LogisticsRateCard extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'status' => LogisticsRateCardStatus::class,
            'version_number' => 'integer',
            'revision' => 'integer',
            'effective_at' => 'immutable_datetime',
            'published_at' => 'immutable_datetime',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(LogisticsOrganization::class, 'logistics_organization_id');
    }

    public function rules(): HasMany
    {
        return $this->hasMany(LogisticsRateRule::class);
    }

    public function services(): HasMany
    {
        return $this->hasMany(LogisticsServiceRate::class);
    }
}
