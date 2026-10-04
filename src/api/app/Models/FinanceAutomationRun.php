<?php

namespace App\Models;

use App\Enums\FinanceAutomationKind;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class FinanceAutomationRun extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['kind' => FinanceAutomationKind::class, 'cutoff_at' => 'immutable_datetime', 'completed_at' => 'immutable_datetime'];
    }
}
