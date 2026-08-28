<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Enums\UserSex;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Database\Seeder;

class InitialCustomerSeeder extends Seeder
{
    public function run(): void
    {
        $email = config('customer.initial.email');
        $password = config('customer.initial.password');

        if (! is_string($email) || $email === '' || ! is_string($password) || $password === '') {
            $this->command?->warn('Initial customer was not created: configure APPROVED_CUSTOMER_EMAIL and APPROVED_CUSTOMER_PASSWORD.');

            return;
        }

        $customer = User::query()->firstOrCreate(
            [
                'email' => strtolower(trim($email)),
                'role' => UserRole::Customer,
            ],
            [
                'password' => $password,
                'status' => UserStatus::Active,
                'email_verified_at' => now(),
            ],
        );

        $customer->customerProfile()->firstOrCreate([], [
            'first_name' => config('customer.initial.first_name', 'Aisley'),
            'last_name' => config('customer.initial.last_name', 'Customer'),
            'contact_number' => config('customer.initial.contact_number', '+639171234567'),
            'sex' => UserSex::PreferNotToSay,
            'birth_date' => config('customer.initial.birth_date', '2000-01-01'),
        ]);
    }
}
