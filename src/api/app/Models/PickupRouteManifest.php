<?php

namespace App\Models;

use App\Enums\PickupRouteManifestStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PickupRouteManifest extends Model
{
    use HasUuids;

    protected $fillable = [
        'pickup_schedule_id', 'schedule_revision', 'status', 'coordinate_source',
        'coordinate_fingerprint', 'estimated_credits', 'total_distance_metres',
        'total_duration_seconds', 'stops', 'geojson', 'failure_reason', 'calculated_at',
    ];

    protected function casts(): array
    {
        return [
            'status' => PickupRouteManifestStatus::class,
            'schedule_revision' => 'integer',
            'estimated_credits' => 'integer',
            'total_distance_metres' => 'integer',
            'total_duration_seconds' => 'integer',
            'stops' => 'array',
            'geojson' => 'array',
            'calculated_at' => 'datetime',
        ];
    }

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(PickupSchedule::class, 'pickup_schedule_id');
    }
}
