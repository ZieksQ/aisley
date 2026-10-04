<?php

namespace App\Models;

use App\Enums\FinancePaymentDirection;
use App\Enums\FinancePaymentStatus;
use App\Enums\GatewayScenario;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SandboxGatewayTransaction extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['direction' => FinancePaymentDirection::class, 'status' => FinancePaymentStatus::class, 'scenario' => GatewayScenario::class, 'amount_cents' => 'integer', 'metadata' => 'array'];
    }
}
