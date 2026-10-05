<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class CourierCashObligation extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['amount_cents' => 'integer', 'delivered_at' => 'datetime', 'received_at' => 'datetime'];
    }
}
