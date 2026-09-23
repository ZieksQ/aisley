<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class FinancialHold extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['placed_at' => 'immutable_datetime', 'released_at' => 'immutable_datetime'];
    }
}
