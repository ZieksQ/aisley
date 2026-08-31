<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Permission;
use App\Models\User;
use Illuminate\Database\Seeder;

class InitialAdminSeeder extends Seeder
{
    public function run(): void
    {
        $email = config('admin.initial.email');
        $password = config('admin.initial.password');
        $normalizedEmail = is_string($email) ? strtolower(trim($email)) : '';

        if ($normalizedEmail === '' || ! is_string($password) || $password === '') {
            $this->command?->warn('Initial admin was not created: configure INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD.');

            return;
        }

        $admin = User::query()->firstOrCreate(
            [
                'email' => $normalizedEmail,
                'role' => UserRole::Admin,
            ],
            [
                'password' => $password,
                'status' => UserStatus::Active,
                'email_verified_at' => now(),
            ],
        );

        $admin->adminProfile()->firstOrCreate([], [
            'first_name' => config('admin.initial.first_name', 'Platform'),
            'last_name' => config('admin.initial.last_name', 'Administrator'),
        ]);

        $admin->permissions()->syncWithoutDetaching(
            Permission::query()
                ->whereIn('slug', [
                    'registrations.view',
                    'registrations.review',
                    'audit-logs.view',
                    'platform-settings.view',
                    'platform-settings.manage',
                    'notifications.view',
                    'users.view',
                    'users.manage',
                    'seller_compliance.manage',
                ])
                ->pluck('id'),
        );
    }
}
