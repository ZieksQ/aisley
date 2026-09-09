<?php

namespace Database\Seeders;

use App\Enums\AddressType;
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

        if (! $seller->addresses()->exists()) {
            $seller->addresses()->create([
                'type' => AddressType::Both,
                'label' => 'Shop pickup address',
                'recipient_name' => trim(implode(' ', array_filter([
                    config('seller.initial.first_name', 'Aisley'),
                    config('seller.initial.last_name', 'Catalog'),
                ]))),
                'contact_number' => config('seller.initial.contact_number', '+639171234568'),
                'address_line_1' => config('seller.initial.address_line_1', '1 Seller Street'),
                'address_line_2' => config('seller.initial.address_line_2'),
                'barangay' => config('seller.initial.barangay', 'Poblacion'),
                'city_municipality' => config('seller.initial.city_municipality', 'Makati City'),
                'province' => config('seller.initial.province', 'Metro Manila'),
                'region' => config('seller.initial.region', 'National Capital Region (NCR)'),
                'postal_code' => config('seller.initial.postal_code', '1200'),
                'country' => 'Philippines',
                'is_default' => true,
            ]);
        }
    }
}
