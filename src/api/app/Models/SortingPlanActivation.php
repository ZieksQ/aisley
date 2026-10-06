<?php

namespace App\Models;

use App\Enums\Logistics\SortingActivationStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SortingPlanActivation extends Model
{
    use HasUuids;

    public $timestamps = true;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['status' => SortingActivationStatus::class, 'scheduled_for' => 'immutable_datetime', 'completed_at' => 'immutable_datetime'];
    }
}
