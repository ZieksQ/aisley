<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SortingPlanVersion extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['mappings' => 'array', 'differences' => 'array', 'number' => 'integer', 'published_at' => 'immutable_datetime'];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new \LogicException('Published sorting versions are immutable.'));
        static::deleting(fn () => throw new \LogicException('Published sorting versions must be retained.'));
    }
}
