<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class RegistrationEmailChallenge extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected $hidden = ['code_hash', 'token', 'token_hash'];

    protected function casts(): array
    {
        return [
            'token' => 'encrypted',
            'attempts' => 'integer',
            'expires_at' => 'datetime',
            'verified_at' => 'datetime',
            'verification_expires_at' => 'datetime',
            'invalidated_at' => 'datetime',
            'consumed_at' => 'datetime',
        ];
    }
}
