<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Permission;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class InitialAdminSeeder extends Seeder
{
    public function run(): void
    {
        $email = config('admin.initial.email');
        $password = config('admin.initial.password');
        $normalizedEmail = is_string($email) ? strtolower(trim($email)) : '';

        if ($normalizedEmail === '') {
            $this->command?->warn('Initial admin was not created: configure INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD.');

            return;
        }

        DB::transaction(function () use ($normalizedEmail, $password): void {
            DB::table('admin_authority_locks')->where('id', 1)->lockForUpdate()->firstOrFail();
            $initial = User::query()->where('is_initial_admin', true)->first();
            if ($initial && $initial->email !== $normalizedEmail) {
                throw new \RuntimeException('An initial admin already exists; preserve INITIAL_ADMIN_EMAIL or reconcile explicitly.');
            }
            $admin = User::query()->where('email', $normalizedEmail)->where('role', UserRole::Admin)->first();
            if (! $admin) {
                if (! is_string($password) || $password === '') {
                    $this->command?->warn('Initial admin was not created: configure INITIAL_ADMIN_PASSWORD.');

                    return;
                }
                $admin = User::query()->create(['email' => $normalizedEmail, 'role' => UserRole::Admin,
                    'password' => $password, 'status' => UserStatus::Active]);
                $admin->forceFill(['email_verified_at' => now()])->save();
            }
            $admin->forceFill(['is_super_admin' => true, 'is_initial_admin' => true])->save();
            $admin->adminProfile()->firstOrCreate([], [
                'first_name' => config('admin.initial.first_name', 'Platform'),
                'last_name' => config('admin.initial.last_name', 'Administrator'),
            ]);
            $admin->permissions()->syncWithoutDetaching(Permission::query()->pluck('id'));
        }, 3);
    }
}
