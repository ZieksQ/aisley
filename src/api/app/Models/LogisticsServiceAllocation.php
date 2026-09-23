<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class LogisticsServiceAllocation extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['distance_meters' => 'integer', 'amount_cents' => 'integer', 'committed_at' => 'immutable_datetime'];
    }
}
