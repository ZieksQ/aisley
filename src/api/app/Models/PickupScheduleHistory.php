<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class PickupScheduleHistory extends Model
{
    use HasUuids;

    protected $table = 'pickup_schedule_history';

    protected $fillable = ['pickup_schedule_id', 'actor_id', 'action', 'revision', 'before', 'after', 'reason', 'occurred_at'];

    protected function casts(): array
    {
        return ['revision' => 'integer', 'before' => 'array', 'after' => 'array', 'occurred_at' => 'datetime'];
    }
}
