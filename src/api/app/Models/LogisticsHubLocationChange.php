<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

class LogisticsHubLocationChange extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $fillable = [
        'logistics_hub_id',
        'actor_id',
        'previous_latitude',
        'previous_longitude',
        'latitude',
        'longitude',
        'reason',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'previous_latitude' => 'decimal:7',
            'previous_longitude' => 'decimal:7',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'created_at' => 'datetime',
        ];
    }

    public function hub(): BelongsTo
    {
        return $this->belongsTo(LogisticsHub::class, 'logistics_hub_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Hub location history is immutable.'));
        static::deleting(fn () => throw new LogicException('Hub location history is immutable.'));
    }
}
