<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class FinancePeriodClosure extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['costs_complete' => 'boolean', 'period_month' => 'immutable_date', 'closed_at' => 'immutable_datetime'];
    }
}
