<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Enums\UserSex;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Database\Seeder;

class InitialSellerSeeder extends Seeder
{
    public function run(): void
    {
        $email = config('seller.initial.email');
        $password = config('seller.initial.password');
        $normalizedEmail = is_string($email) ? strtolower(trim($email)) : '';

        if ($normalizedEmail === '' || ! is_string($password) || $password === '') {
            $this->command?->warn('Initial seller was not created: configure INITIAL_SELLER_EMAIL and INITIAL_SELLER_PASSWORD.');

            return;
        }

        $seller = User::query()->firstOrCreate(
            [
                'email' => $normalizedEmail,
                'role' => UserRole::Seller,
            ],
            [
                'password' => $password,
                'status' => UserStatus::Active,
                'email_verified_at' => now(),
            ],
        );

        $seller->sellerProfile()->firstOrCreate([], [
            'first_name' => config('seller.initial.first_name', 'Aisley'),
            'last_name' => config('seller.initial.last_name', 'Catalog'),
            'contact_number' => config('seller.initial.contact_number', '+639171234568'),
            'sex' => UserSex::PreferNotToSay,
            'birth_date' => config('seller.initial.birth_date', '1995-01-01'),
        ]);
    }
}
