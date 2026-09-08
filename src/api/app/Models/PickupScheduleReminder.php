<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PickupScheduleReminder extends Model
{
    use HasUuids;

    protected $fillable = ['pickup_schedule_id', 'schedule_revision', 'due_at', 'status', 'attempts', 'claimed_at', 'sent_at', 'failed_at', 'last_error'];

    protected function casts(): array
    {
        return ['schedule_revision' => 'integer', 'due_at' => 'datetime', 'claimed_at' => 'datetime', 'sent_at' => 'datetime', 'failed_at' => 'datetime'];
    }

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(PickupSchedule::class, 'pickup_schedule_id');
    }
}
