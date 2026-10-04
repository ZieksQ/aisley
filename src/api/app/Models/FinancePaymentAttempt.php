<?php

namespace App\Models;

use App\Enums\FinancePaymentDirection;
use App\Enums\FinancePaymentStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class FinancePaymentAttempt extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['direction' => FinancePaymentDirection::class, 'status' => FinancePaymentStatus::class, 'amount_cents' => 'integer', 'resolved_at' => 'immutable_datetime'];
    }
}
