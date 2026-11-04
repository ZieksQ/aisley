<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class OrderModificationQuote extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['expected_revision' => 'integer', 'expires_at' => 'immutable_datetime'];
    }
}
