<?php

namespace App\Models;

use App\Enums\UserRole;
use App\Enums\WaybillAccessAction;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class WaybillAccessEvent extends Model
{
    use HasUuids;

    protected $fillable = ['waybill_id', 'actor_id', 'actor_role', 'action', 'correlation_id', 'occurred_at'];

    protected function casts(): array
    {
        return ['actor_role' => UserRole::class, 'action' => WaybillAccessAction::class, 'occurred_at' => 'datetime'];
    }
}
