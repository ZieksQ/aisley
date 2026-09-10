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

        $this->seedLogistics($normalizedEmail, $password, [
            'first_name' => config('logistics.initial.first_name', 'Aisley'),
            'last_name' => config('logistics.initial.last_name', 'Logistics'),
            'contact_number' => config('logistics.initial.contact_number', '+639171234569'),
            'birth_date' => config('logistics.initial.birth_date', '1990-01-01'),
            'business_name' => config('logistics.initial.business_name', 'Aisley Logistics'),
            'hub_name' => config('logistics.initial.hub_name', 'Aisley Logistics Operational Hub'),
            'address_line_1' => config('logistics.initial.address_line_1', '1 Logistics Center'),
            'address_line_2' => config('logistics.initial.address_line_2'),
            'barangay' => config('logistics.initial.barangay', 'Poblacion'),
            'city_municipality' => config('logistics.initial.city_municipality', 'Makati City'),
            'province' => config('logistics.initial.province', 'Metro Manila'),
            'region' => config('logistics.initial.region', 'National Capital Region (NCR)'),
            'postal_code' => config('logistics.initial.postal_code', '1200'),
        ]);

        $count = min(100, max(0, (int) config('logistics.generic.count', 5)));
        $prefix = trim((string) config('logistics.generic.email_prefix', 'logistics')) ?: 'logistics';
        $domain = trim((string) config('logistics.generic.email_domain', 'example.com')) ?: 'example.com';

        for ($number = 1; $number <= $count; $number++) {
            $sequence = sprintf('%02d', $number);
            $this->seedLogistics(
                sprintf('%s%s@%s', $prefix, $sequence, $domain),
                $password,
                [
                    'first_name' => 'Logistics',
                    'last_name' => 'Test '.$sequence,
                    'contact_number' => sprintf('+63917020%04d', $number),
                    'birth_date' => '1990-01-01',
                    'business_name' => 'Aisley Logistics Test '.$sequence,
                    'hub_name' => 'Aisley Logistics Test Hub '.$sequence,
                    'address_line_1' => sprintf('%d Logistics Street', $number),
                    'address_line_2' => null,
                    'barangay' => 'Poblacion',
                    'city_municipality' => 'Makati City',
                    'province' => 'Metro Manila',
                    'region' => 'National Capital Region (NCR)',
                    'postal_code' => '1200',
                ],
            );
        }
    }

    /** @param array{first_name: string, last_name: string, contact_number: string, birth_date: string, business_name: string, hub_name: string, address_line_1: string, address_line_2: string|null, barangay: string, city_municipality: string, province: string, region: string, postal_code: string} $details */
    private function seedLogistics(string $email, string $password, array $details): void
    {
        $logistics = User::query()->firstOrCreate(
            ['email' => $email, 'role' => UserRole::Logistics],
            ['password' => $password, 'status' => UserStatus::Active, 'email_verified_at' => now()],
        );

        $logistics->logisticsProfile()->firstOrCreate([], [
            'first_name' => $details['first_name'],
            'last_name' => $details['last_name'],
            'contact_number' => $details['contact_number'],
            'sex' => UserSex::PreferNotToSay,
            'birth_date' => $details['birth_date'],
        ]);

        $address = $logistics->addresses()->firstOrCreate(
            ['label' => 'Operational hub/sorting-center address'],
            [
                'type' => AddressType::Both,
                'recipient_name' => trim($details['first_name'].' '.$details['last_name']),
                'contact_number' => $details['contact_number'],
                'address_line_1' => $details['address_line_1'],
                'address_line_2' => $details['address_line_2'],
                'barangay' => $details['barangay'],
                'city_municipality' => $details['city_municipality'],
                'province' => $details['province'],
                'region' => $details['region'],
                'postal_code' => $details['postal_code'],
                'country' => 'Philippines',
                'is_default' => true,
            ],
        );

        $organization = $logistics->logisticsOrganization()->firstOrCreate([], [
            'business_name' => $details['business_name'],
        ]);

        $organization->hub()->firstOrCreate([], [
            'address_id' => $address->id,
            'name' => $details['hub_name'],
        ]);
    }
}
