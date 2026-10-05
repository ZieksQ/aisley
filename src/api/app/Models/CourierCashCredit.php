<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class CourierCashCredit extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['amount_cents' => 'integer', 'credited_at' => 'datetime'];
    }
}
