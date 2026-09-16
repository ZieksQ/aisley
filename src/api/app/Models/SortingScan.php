<?php

namespace App\Models;

use App\Enums\Logistics\SortingExceptionCode;
use App\Enums\Logistics\SortingScanOutcome;
use App\Enums\Logistics\SortingScanSource;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SortingScan extends Model
{
    use HasUuids;

    protected $fillable = [
        'logistics_organization_id', 'logistics_hub_id', 'sorting_session_id', 'sorting_session_item_id',
        'sorting_lane_id', 'sorting_plan_id', 'sorting_plan_lane_id', 'automatic_routing', 'shipment_id', 'recorded_by_logistics_id', 'client_id', 'request_hash',
        'reference', 'outcome', 'source', 'exception_code', 'reason', 'captured_at', 'processed_at',
    ];

    protected function casts(): array
    {
        return [
            'outcome' => SortingScanOutcome::class,
            'source' => SortingScanSource::class,
            'exception_code' => SortingExceptionCode::class,
            'automatic_routing' => 'boolean',
            'captured_at' => 'datetime',
            'processed_at' => 'datetime',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(SortingSession::class, 'sorting_session_id');
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(SortingSessionItem::class, 'sorting_session_item_id');
    }

    public function lane(): BelongsTo
    {
        return $this->belongsTo(SortingLane::class, 'sorting_lane_id');
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(SortingPlan::class, 'sorting_plan_id');
    }

    public function planLane(): BelongsTo
    {
        return $this->belongsTo(SortingPlanLane::class, 'sorting_plan_lane_id');
    }

    public function shipment(): BelongsTo
    {
        return $this->belongsTo(Shipment::class);
    }
}
