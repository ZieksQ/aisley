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
        $normalizedEmail = is_string($email) ? strtolower(trim($email)) : '';

        if ($normalizedEmail === '' || ! is_string($password) || $password === '') {
            $this->command?->warn('Initial customer was not created: configure APPROVED_CUSTOMER_EMAIL and APPROVED_CUSTOMER_PASSWORD.');

            return;
        }

        $this->seedCustomer($normalizedEmail, $password, [
            'first_name' => config('customer.initial.first_name', 'Aisley'),
            'last_name' => config('customer.initial.last_name', 'Customer'),
            'contact_number' => config('customer.initial.contact_number', '+639171234567'),
            'birth_date' => config('customer.initial.birth_date', '2000-01-01'),
        ]);

        $count = min(100, max(0, (int) config('customer.generic.count', 20)));
        $prefix = trim((string) config('customer.generic.email_prefix', 'customer')) ?: 'customer';
        $domain = trim((string) config('customer.generic.email_domain', 'example.com')) ?: 'example.com';

        for ($number = 1; $number <= $count; $number++) {
            $this->seedCustomer(
                sprintf('%s%02d@%s', $prefix, $number, $domain),
                $password,
                [
                    'first_name' => 'Customer',
                    'last_name' => sprintf('Test %02d', $number),
                    'contact_number' => sprintf('+63917000%04d', $number),
                    'birth_date' => '2000-01-01',
                ],
            );
        }
    }

    /** @param array{first_name: string, last_name: string, contact_number: string, birth_date: string} $details */
    private function seedCustomer(string $email, string $password, array $details): void
    {
        $customer = User::query()->firstOrCreate(
            ['email' => $email, 'role' => UserRole::Customer],
            ['password' => $password, 'status' => UserStatus::Active, 'email_verified_at' => now()],
        );

        $customer->customerProfile()->firstOrCreate([], [
            'first_name' => $details['first_name'],
            'last_name' => $details['last_name'],
            'contact_number' => $details['contact_number'],
            'sex' => UserSex::PreferNotToSay,
            'birth_date' => $details['birth_date'],
        ]);
    }
}
