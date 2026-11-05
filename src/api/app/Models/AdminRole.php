<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class AdminRole extends Model
{
    use HasUuids;

    protected $fillable = ['name'];

    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class, 'admin_role_permissions');
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'admin_role_memberships');
    }
}
