<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FinancePayout extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['amount_cents' => 'integer', 'is_sandbox' => 'boolean', 'eligible_through' => 'immutable_datetime', 'submitted_at' => 'immutable_datetime', 'resolved_at' => 'immutable_datetime'];
    }

    public function items(): HasMany
    {
        return $this->hasMany(FinancePayoutItem::class);
    }
}
