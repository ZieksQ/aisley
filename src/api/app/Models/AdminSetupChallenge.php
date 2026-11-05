<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class AdminSetupChallenge extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected $hidden = ['code_hash', 'identity_fingerprint', 'replacement_fingerprint'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'consumed_at' => 'datetime', 'invalidated_at' => 'datetime'];
    }
}
