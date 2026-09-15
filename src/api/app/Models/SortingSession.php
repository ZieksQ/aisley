<?php

namespace App\Models;

use App\Enums\Logistics\SortingSessionStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SortingSession extends Model
{
    use HasUuids;

    protected $fillable = [
        'logistics_organization_id', 'logistics_hub_id', 'opened_by_logistics_id', 'closed_by_logistics_id',
        'reference', 'status', 'open_key', 'expected_count', 'revision', 'idempotency_key', 'request_hash',
        'opened_at', 'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => SortingSessionStatus::class,
            'expected_count' => 'integer',
            'revision' => 'integer',
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
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

    public function scans(): HasMany
    {
        return $this->hasMany(SortingScan::class);
    }
}
