<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Permission;
use App\Models\User;
use Illuminate\Database\Seeder;

class InitialAdminSeeder extends Seeder
{
    private const TEST_ADMIN_EMAIL = 'admin@test.com';

    private const TEST_ADMIN_PASSWORD = 'Admin12345';

    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            return;
        }

        $admin = User::query()->updateOrCreate(
            [
                'email' => self::TEST_ADMIN_EMAIL,
                'role' => UserRole::Admin,
            ],
            [
                'password' => self::TEST_ADMIN_PASSWORD,
                'status' => UserStatus::Active,
                'email_verified_at' => now(),
            ],
        );

        $admin->adminProfile()->updateOrCreate([], [
            'first_name' => 'Test',
            'last_name' => 'Administrator',
        ]);

        $admin->permissions()->syncWithoutDetaching(
            Permission::query()
                ->whereIn('slug', ['registrations.view', 'registrations.review', 'audit-logs.view'])
                ->pluck('id'),
        );
    }
}
