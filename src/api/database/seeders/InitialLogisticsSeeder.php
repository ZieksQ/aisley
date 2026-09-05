<?php

namespace Database\Seeders;

use App\Enums\AddressType;
use App\Enums\UserRole;
use App\Enums\UserSex;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Database\Seeder;

class InitialLogisticsSeeder extends Seeder
{
    public function run(): void
    {
        $email = config('logistics.initial.email');
        $password = config('logistics.initial.password');
        $normalizedEmail = is_string($email) ? strtolower(trim($email)) : '';

        if ($normalizedEmail === '' || ! is_string($password) || $password === '') {
            $this->command?->warn('Initial Logistics account was not created: configure INITIAL_LOGISTICS_EMAIL and INITIAL_LOGISTICS_PASSWORD.');

            return;
        }

        $logistics = User::query()->firstOrCreate(
            ['email' => $normalizedEmail, 'role' => UserRole::Logistics],
            ['password' => $password, 'status' => UserStatus::Active, 'email_verified_at' => now()],
        );

        $logistics->logisticsProfile()->firstOrCreate([], [
            'first_name' => config('logistics.initial.first_name', 'Aisley'),
            'last_name' => config('logistics.initial.last_name', 'Logistics'),
            'contact_number' => config('logistics.initial.contact_number', '+639171234569'),
            'sex' => UserSex::PreferNotToSay,
            'birth_date' => config('logistics.initial.birth_date', '1990-01-01'),
        ]);

        $address = $logistics->addresses()->firstOrCreate(
            ['label' => 'Operational hub/sorting-center address'],
            [
                'type' => AddressType::Both,
                'recipient_name' => trim(implode(' ', array_filter([
                    config('logistics.initial.first_name', 'Aisley'),
                    config('logistics.initial.last_name', 'Logistics'),
                ]))),
                'contact_number' => config('logistics.initial.contact_number', '+639171234569'),
                'address_line_1' => config('logistics.initial.address_line_1', '1 Logistics Center'),
                'address_line_2' => config('logistics.initial.address_line_2'),
                'barangay' => config('logistics.initial.barangay', 'Poblacion'),
                'city_municipality' => config('logistics.initial.city_municipality', 'Makati City'),
                'province' => config('logistics.initial.province', 'Metro Manila'),
                'region' => config('logistics.initial.region', 'National Capital Region (NCR)'),
                'postal_code' => config('logistics.initial.postal_code', '1200'),
                'country' => 'Philippines',
                'is_default' => true,
            ],
        );

        $organization = $logistics->logisticsOrganization()->firstOrCreate([], [
            'business_name' => config('logistics.initial.business_name', 'Aisley Logistics'),
        ]);

        $organization->hub()->firstOrCreate([], [
            'address_id' => $address->id,
            'name' => config('logistics.initial.hub_name', 'Aisley Logistics Operational Hub'),
        ]);
    }
}
