<?php

namespace App\Models;

use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class PasswordChangeChallenge extends Model
{
    use HasUuids;

    protected $guarded = [];

    protected $hidden = ['code_hash', 'identity_fingerprint', 'password_fingerprint'];

    protected function casts(): array
    {
        return [
            'role' => UserRole::class,
            'attempts' => 'integer',
            'expires_at' => 'datetime',
            'consumed_at' => 'datetime',
            'invalidated_at' => 'datetime',
        ];
    }
}
