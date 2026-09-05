<?php

namespace Database\Seeders;

use App\Enums\AddressType;
use App\Enums\CourierAffiliationStatus;
use App\Enums\UserRole;
use App\Enums\UserSex;
use App\Enums\UserStatus;
use App\Enums\VehicleStatus;
use App\Enums\VehicleType;
use App\Models\LogisticsOrganization;
use App\Models\User;
use Illuminate\Database\Seeder;

class CourierSeeder extends Seeder
{
    public function run(): void
    {
        $password = config('courier.initial.password');
        if (! is_string($password) || $password === '') {
            $this->command?->warn('Courier accounts were not created: configure INITIAL_COURIER_PASSWORD.');

            return;
        }

        $organization = $this->organization();
        if (! $organization?->hub) {
            $this->command?->warn('Courier accounts were not created: seed an active Logistics organization with a hub first.');

            return;
        }

        $initialEmail = config('courier.initial.email');
        if (is_string($initialEmail) && trim($initialEmail) !== '') {
            $this->seedCourier(strtolower(trim($initialEmail)), $password, [
                'first_name' => config('courier.initial.first_name', 'Aisley'),
                'last_name' => config('courier.initial.last_name', 'Courier'),
                'middle_name' => config('courier.initial.middle_name'),
                'contact_number' => config('courier.initial.contact_number', '+639171234570'),
                'birth_date' => config('courier.initial.birth_date', '1995-01-01'),
                'vehicle_type' => config('courier.initial.vehicle_type', VehicleType::Motorcycle->value),
                'plate_number' => config('courier.initial.plate_number', 'AISLEY-001'),
                'address_line_1' => config('courier.initial.address_line_1', '1 Courier Street'),
                'address_line_2' => config('courier.initial.address_line_2'),
                'barangay' => config('courier.initial.barangay', 'Poblacion'),
                'city_municipality' => config('courier.initial.city_municipality', 'Makati City'),
                'province' => config('courier.initial.province', 'Metro Manila'),
                'region' => config('courier.initial.region', 'National Capital Region (NCR)'),
                'postal_code' => config('courier.initial.postal_code', '1200'),
            ], $organization);
        }

        $count = min(100, max(0, (int) config('courier.generic.count', 20)));
        $prefix = trim((string) config('courier.generic.email_prefix', 'courier')) ?: 'courier';
        $domain = trim((string) config('courier.generic.email_domain', 'example.com')) ?: 'example.com';
        for ($number = 1; $number <= $count; $number++) {
            $this->seedCourier(
                sprintf('%s%02d@%s', $prefix, $number, $domain),
                $password,
                [
                    'first_name' => 'Courier',
                    'last_name' => sprintf('Test %02d', $number),
                    'contact_number' => sprintf('+63917000%04d', $number),
                    'birth_date' => '1995-01-01',
                    'vehicle_type' => VehicleType::Motorcycle->value,
                    'plate_number' => sprintf('TEST-%03d', $number),
                    'address_line_1' => sprintf('%d Courier Street', $number),
                    'barangay' => 'Poblacion',
                    'city_municipality' => 'Makati City',
                    'province' => 'Metro Manila',
                    'region' => 'National Capital Region (NCR)',
                    'postal_code' => '1200',
                ],
                $organization,
            );
        }
    }

    private function organization(): ?LogisticsOrganization
    {
        $email = trim((string) config('courier.initial.logistics_email', ''));

        return LogisticsOrganization::query()
            ->when($email !== '', fn ($query) => $query->whereHas('user', fn ($users) => $users->where('email', strtolower($email))))
            ->whereHas('user', fn ($query) => $query->where('role', UserRole::Logistics)->where('status', UserStatus::Active))
            ->with('hub')
            ->orderBy('id')
            ->first();
    }

    /** @param array<string, mixed> $details */
    private function seedCourier(string $email, string $password, array $details, LogisticsOrganization $organization): void
    {
        $courier = User::query()->firstOrCreate(
            ['email' => $email, 'role' => UserRole::Courier],
            ['password' => $password, 'status' => UserStatus::Active, 'email_verified_at' => now()],
        );
        $courier->courierProfile()->firstOrCreate([], [
            'first_name' => $details['first_name'], 'last_name' => $details['last_name'], 'middle_name' => $details['middle_name'] ?? null,
            'contact_number' => $details['contact_number'], 'sex' => UserSex::PreferNotToSay, 'birth_date' => $details['birth_date'],
        ]);
        $address = $courier->addresses()->firstOrCreate(['label' => 'Courier address'], [
            'type' => AddressType::Both, 'recipient_name' => trim($details['first_name'].' '.$details['last_name']), 'contact_number' => $details['contact_number'],
            'address_line_1' => $details['address_line_1'], 'address_line_2' => $details['address_line_2'] ?? null, 'barangay' => $details['barangay'],
            'city_municipality' => $details['city_municipality'], 'province' => $details['province'], 'region' => $details['region'],
            'postal_code' => $details['postal_code'], 'country' => 'Philippines', 'is_default' => true,
        ]);
        $courier->courierProfile->vehicles()->firstOrCreate(['plate_number' => $details['plate_number']], ['type' => $details['vehicle_type'], 'status' => VehicleStatus::Active]);
        $courier->courierLogisticsAffiliation()->firstOrCreate([], ['logistics_organization_id' => $organization->id, 'logistics_hub_id' => $organization->hub->id, 'status' => CourierAffiliationStatus::Approved, 'reviewer_id' => $organization->user_id, 'reviewed_at' => now()]);
    }
}
