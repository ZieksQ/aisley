<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class LogisticsRouteReconciliation extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'shipping_pool_cents' => 'integer',
            'platform_subsidy_cents' => 'integer',
            'total_allocation_cents' => 'integer',
            'allocations' => 'array',
            'reconciled_at' => 'immutable_datetime',
        ];
    }
}
