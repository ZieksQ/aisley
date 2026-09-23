<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FinanceExpense extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['amount_cents' => 'integer', 'is_recurring_monthly' => 'boolean', 'incurred_on' => 'immutable_date'];
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(FinanceExpenseAllocation::class);
    }
}
