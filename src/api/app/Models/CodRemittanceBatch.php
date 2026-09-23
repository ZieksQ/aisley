<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CodRemittanceBatch extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['total_cents' => 'integer', 'submitted_at' => 'immutable_datetime', 'cleared_at' => 'immutable_datetime'];
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(CodRemittanceAllocation::class);
    }
}
