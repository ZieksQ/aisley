<?php

namespace App\Models;

use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class RegistrationEmailIdentity extends Model
{
    use HasUuids;

    protected $fillable = ['email', 'role'];

    protected function casts(): array
    {
        return ['role' => UserRole::class];
    }
}
