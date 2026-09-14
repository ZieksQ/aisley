<?php

namespace App\Models;

use App\Enums\Logistics\SortingExceptionCode;
use App\Enums\Logistics\SortingItemStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SortingSessionItem extends Model
{
    use HasUuids;

    protected $fillable = [
        'sorting_session_id', 'shipment_id', 'sorting_lane_id', 'status', 'expected_shipment_revision',
        'exception_code', 'exception_reason', 'exception_recorded_at', 'exception_resolved_at', 'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => SortingItemStatus::class,
            'expected_shipment_revision' => 'integer',
            'exception_code' => SortingExceptionCode::class,
            'exception_recorded_at' => 'datetime',
            'exception_resolved_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(SortingSession::class, 'sorting_session_id');
    }

    public function shipment(): BelongsTo
    {
        return $this->belongsTo(Shipment::class);
    }

    public function lane(): BelongsTo
    {
        return $this->belongsTo(SortingLane::class, 'sorting_lane_id');
    }

    public function scans(): HasMany
    {
        return $this->hasMany(SortingScan::class);
    }
}
