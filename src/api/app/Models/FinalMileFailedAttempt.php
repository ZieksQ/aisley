<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class FinalMileFailedAttempt extends Model
{
    use HasUuids;

    protected $fillable = ['delivery_task_id', 'courier_id', 'reason', 'note', 'idempotency_key', 'request_hash', 'attempted_at'];

    protected function casts(): array
    {
        return ['attempted_at' => 'datetime'];
    }
}
