<?php

namespace App\Models\Concerns;

use App\Enums\UserRole;
use App\Models\AdminRole;
use App\Models\Permission;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Collection;

trait HasAdminAuthority
{
    public function adminRoles(): BelongsToMany
    {
        return $this->belongsToMany(AdminRole::class, 'admin_role_memberships');
    }

    public function effectiveAdminPermissions(): Collection
    {
        if ($this->role !== UserRole::Admin) {
            return collect();
        }
        if ($this->is_super_admin) {
            return Permission::query()->pluck('slug');
        }

        return $this->permissions()->pluck('slug')->merge(
            Permission::query()->whereHas('adminRoles', fn ($query) => $query->whereHas('members', fn ($members) => $members->where('users.id', $this->id)))->pluck('slug'),
        )->unique()->sort()->values();
    }

    public function hasAdminPermission(string $slug): bool
    {
        return $this->role === UserRole::Admin && ($this->is_super_admin || $this->effectiveAdminPermissions()->contains($slug));
    }

    public function scopeWithAdminPermission(Builder $query, string $slug): Builder
    {
        return $query->where('role', UserRole::Admin)->where(fn ($authority) => $authority
            ->where('is_super_admin', true)
            ->orWhereHas('permissions', fn ($grants) => $grants->where('slug', $slug))
            ->orWhereHas('adminRoles.permissions', fn ($grants) => $grants->where('slug', $slug)));
    }

    public function requiresAdminSetup(): bool
    {
        return $this->role === UserRole::Admin && ($this->admin_setup_required || $this->admin_email_verification_required);
    }
}
