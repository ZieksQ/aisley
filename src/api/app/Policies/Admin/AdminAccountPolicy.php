<?php

namespace App\Policies\Admin;

use App\Enums\UserRole;
use App\Models\User;

class AdminAccountPolicy
{
    public function manage(User $actor, User $target): bool
    {
        if ($target->role !== UserRole::Admin || $actor->id === $target->id) {
            return false;
        }

        return $actor->is_super_admin || (! $target->is_super_admin
            && $target->effectiveAdminPermissions()->diff($actor->effectiveAdminPermissions())->isEmpty());
    }
}
