<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Database\Seeder;

class InitialAdminSeeder extends Seeder
{
    public function run(): void
    {
        $email = config('admin.initial.email');
        $password = config('admin.initial.password');

        if (! is_string($email) || $email === '' || ! is_string($password) || $password === '') {
            $this->command?->warn('Initial admin was not created: configure INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD.');

            return;
        }

        $admin = User::query()->firstOrCreate(
            [
                'email' => strtolower(trim($email)),
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
    }
}
