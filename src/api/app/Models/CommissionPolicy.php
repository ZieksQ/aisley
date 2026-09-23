<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class CommissionPolicy extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['rate_basis_points' => 'integer', 'effective_at' => 'immutable_datetime', 'ends_at' => 'immutable_datetime', 'revision' => 'integer'];
    }
}
