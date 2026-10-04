<?php

namespace App\Models;

use App\Enums\GatewayScenario;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SandboxGatewayAccount extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['balance_cents' => 'integer', 'is_active' => 'boolean', 'scenario' => GatewayScenario::class];
    }
}
