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

        $this->seedSeller($normalizedEmail, $password, [
            'first_name' => config('seller.initial.first_name', 'Aisley'),
            'last_name' => config('seller.initial.last_name', 'Catalog'),
            'contact_number' => config('seller.initial.contact_number', '+639171234568'),
            'birth_date' => config('seller.initial.birth_date', '1995-01-01'),
            'address_line_1' => config('seller.initial.address_line_1', '1 Seller Street'),
            'address_line_2' => config('seller.initial.address_line_2'),
            'barangay' => config('seller.initial.barangay', 'Poblacion'),
            'city_municipality' => config('seller.initial.city_municipality', 'Makati City'),
            'province' => config('seller.initial.province', 'Metro Manila'),
            'region' => config('seller.initial.region', 'National Capital Region (NCR)'),
            'postal_code' => config('seller.initial.postal_code', '1200'),
        ]);

        $count = min(100, max(0, (int) config('seller.generic.count', 5)));
        $prefix = trim((string) config('seller.generic.email_prefix', 'seller')) ?: 'seller';
        $domain = trim((string) config('seller.generic.email_domain', 'example.com')) ?: 'example.com';

        for ($number = 1; $number <= $count; $number++) {
            $this->seedSeller(
                sprintf('%s%02d@%s', $prefix, $number, $domain),
                $password,
                [
                    'first_name' => 'Seller',
                    'last_name' => sprintf('Test %02d', $number),
                    'contact_number' => sprintf('+63917010%04d', $number),
                    'birth_date' => '1995-01-01',
                    'address_line_1' => sprintf('%d Seller Street', $number),
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

    /** @param array{first_name: string, last_name: string, contact_number: string, birth_date: string, address_line_1: string, address_line_2: string|null, barangay: string, city_municipality: string, province: string, region: string, postal_code: string} $details */
    private function seedSeller(string $email, string $password, array $details): void
    {
        $seller = User::query()->firstOrCreate(
            ['email' => $email, 'role' => UserRole::Seller],
            ['password' => $password, 'status' => UserStatus::Active, 'email_verified_at' => now()],
        );

        $seller->sellerProfile()->firstOrCreate([], [
            'first_name' => $details['first_name'],
            'last_name' => $details['last_name'],
            'contact_number' => $details['contact_number'],
            'sex' => UserSex::PreferNotToSay,
            'birth_date' => $details['birth_date'],
        ]);

        if (! $seller->addresses()->exists()) {
            $seller->addresses()->create([
                'type' => AddressType::Both,
                'label' => 'Shop pickup address',
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
            ]);
        }
    }
}
