<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class FinancialHold extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['placed_at' => 'immutable_datetime', 'released_at' => 'immutable_datetime'];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function routeReconciliation(): HasOne
    {
        return $this->hasOne(LogisticsRouteReconciliation::class);
    }
}
