<?php

namespace App\Services\Admin\Provisioning;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Permission;
use App\Models\User;
use Closure;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AdminAuthority
{
    public function mutate(User $actor, string $permission, string $currentPassword, Closure $mutation): mixed
    {
        return DB::transaction(function () use ($actor, $permission, $currentPassword, $mutation) {
            DB::table('admin_authority_locks')->where('id', 1)->lockForUpdate()->firstOrFail();
            DB::table('users')->where('id', $actor->id)->lockForUpdate()->firstOrFail();
            $actor->refresh();
            abort_unless($actor->role === UserRole::Admin && $actor->status === UserStatus::Active && ! $actor->requiresAdminSetup(), 403);
            abort_unless($actor->hasAdminPermission($permission), 403);
            if (! Hash::check($currentPassword, $actor->password)) {
                throw ValidationException::withMessages(['current_password' => ['The password is incorrect.']]);
            }

            return $mutation();
        }, 3);
    }

    public function normalize(array $slugs): array
    {
        foreach ($slugs as $slug) {
            $prefix = str_contains($slug, '.') ? substr($slug, 0, strrpos($slug, '.')) : '';
            if ($prefix === 'registrations' && $slug === 'registrations.review') {
                $slugs[] = 'registrations.view';
            } elseif ($prefix !== '' && Permission::query()->where('slug', $prefix.'.view')->exists()) {
                $slugs[] = $prefix.'.view';
            }
        }
        $slugs = array_values(array_unique($slugs));
        sort($slugs);
        if (Permission::query()->whereIn('slug', $slugs)->count() !== count($slugs)) {
            throw ValidationException::withMessages(['permissions' => ['Select valid permissions.']]);
        }

        return $slugs;
    }

    public function assertGrantable(User $actor, array $slugs): void
    {
        abort_unless($actor->is_super_admin || collect($slugs)->diff($actor->effectiveAdminPermissions())->isEmpty(), 403, 'You can grant only permissions you hold.');
    }

    public function assertRevision(int $actual, int $expected): void
    {
        abort_unless($actual === $expected, 409, 'This record changed. Reload before saving.');
    }
}
