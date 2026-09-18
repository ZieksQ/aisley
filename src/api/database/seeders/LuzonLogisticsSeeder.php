<?php

namespace Database\Seeders;

use App\Enums\AddressType;
use App\Enums\UserRole;
use App\Enums\UserSex;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Development fixture accounts for exercising the multi-hub routing flow.
 *
 * These are representative hub coordinates near regional logistics centers;
 * they are not claims about the exact premises of any third-party operator.
 */
class LuzonLogisticsSeeder extends Seeder
{
    private const PASSWORD = 'logistics123';

    // Location references consulted on 2026-09-18:
    // PSA PSGC regions; LBC's regional/branch listings for Benguet, Cagayan,
    // Pampanga, Laguna, Oriental Mindoro, and Albay; Napintas Logistics'
    // La Union distribution office; and RLX Calamba's Shopee Xpress hub.
    // The seed stores the province and a representative city coordinate only.

    /** @var array<int, array<string, string|float>> */
    private const REGIONAL_HUBS = [
        [
            'slug' => 'ncr',
            'region' => 'National Capital Region (NCR)',
            'province' => 'Metro Manila',
            'city' => 'Manila',
            'barangay' => 'Port Area',
            'postal_code' => '1018',
            'latitude' => 14.5995,
            'longitude' => 120.9842,
            'center' => 'Manila regional sorting center',
        ],
        [
            'slug' => 'car',
            'region' => 'Cordillera Administrative Region (CAR)',
            'province' => 'Benguet',
            'city' => 'Baguio City',
            'barangay' => 'Kagitingan',
            'postal_code' => '2600',
            'latitude' => 16.4023,
            'longitude' => 120.5960,
            'center' => 'Baguio regional sorting center',
        ],
        [
            'slug' => 'region-1',
            'region' => 'Region I (Ilocos Region)',
            'province' => 'La Union',
            'city' => 'San Fernando City',
            'barangay' => 'Catbangen',
            'postal_code' => '2500',
            'latitude' => 16.6159,
            'longitude' => 120.3160,
            'center' => 'San Fernando North Luzon distribution center',
        ],
        [
            'slug' => 'region-2',
            'region' => 'Region II (Cagayan Valley)',
            'province' => 'Cagayan',
            'city' => 'Tuguegarao City',
            'barangay' => 'Carig',
            'postal_code' => '3500',
            'latitude' => 17.6132,
            'longitude' => 121.7270,
            'center' => 'Carig regional sorting center',
        ],
        [
            'slug' => 'region-3',
            'region' => 'Region III (Central Luzon)',
            'province' => 'Pampanga',
            'city' => 'San Fernando City',
            'barangay' => 'San Isidro',
            'postal_code' => '2000',
            'latitude' => 15.0298,
            'longitude' => 120.6941,
            'center' => 'San Fernando Central Luzon distribution center',
        ],
        [
            'slug' => 'region-4a',
            'region' => 'Region IV-A (CALABARZON)',
            'province' => 'Laguna',
            'city' => 'Calamba City',
            'barangay' => 'Paciano Rizal',
            'postal_code' => '4027',
            'latitude' => 14.2117,
            'longitude' => 121.1653,
            'center' => 'Calamba Southern Luzon sorting center',
        ],
        [
            'slug' => 'region-4b',
            'region' => 'MIMAROPA Region',
            'province' => 'Oriental Mindoro',
            'city' => 'Calapan City',
            'barangay' => 'Tawiran',
            'postal_code' => '5200',
            'latitude' => 13.4117,
            'longitude' => 121.1803,
            'center' => 'Calapan MIMAROPA distribution center',
        ],
        [
            'slug' => 'region-5',
            'region' => 'Region V (Bicol Region)',
            'province' => 'Albay',
            'city' => 'Legazpi City',
            'barangay' => 'Capantawan',
            'postal_code' => '4500',
            'latitude' => 13.1391,
            'longitude' => 123.7438,
            'center' => 'Legazpi Bicol regional sorting center',
        ],
    ];

    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command?->warn('Luzon Logistics development accounts were not seeded in production.');

            return;
        }

        foreach (self::REGIONAL_HUBS as $number => $hub) {
            $sequence = str_pad((string) ($number + 1), 2, '0', STR_PAD_LEFT);
            $this->seedLogistics(
                "logistics.luzon{$sequence}@example.com",
                $hub,
                $number + 1,
            );
        }
    }

    /** @param array<string, string|float> $hub */
    private function seedLogistics(string $email, array $hub, int $number): void
    {
        $contactNumber = sprintf('+63917030%04d', $number);
        $logistics = User::query()->firstOrCreate(
            ['email' => $email, 'role' => UserRole::Logistics],
            ['password' => self::PASSWORD, 'status' => UserStatus::Active, 'email_verified_at' => now()],
        );

        $logistics->logisticsProfile()->firstOrCreate([], [
            'first_name' => 'Luzon',
            'last_name' => 'Logistics '.strtoupper((string) $hub['slug']),
            'contact_number' => $contactNumber,
            'sex' => UserSex::PreferNotToSay,
            'birth_date' => '1990-01-01',
        ]);

        $address = $logistics->addresses()->firstOrCreate(
            ['label' => 'Luzon regional hub seed address'],
            [
                'type' => AddressType::Both,
                'recipient_name' => 'Luzon Logistics '.strtoupper((string) $hub['slug']),
                'contact_number' => $contactNumber,
                'address_line_1' => 'Regional sorting center demo address',
                'address_line_2' => null,
                'barangay' => $hub['barangay'],
                'city_municipality' => $hub['city'],
                'province' => $hub['province'],
                'region' => $hub['region'],
                'postal_code' => $hub['postal_code'],
                'country' => 'Philippines',
                'latitude' => $hub['latitude'],
                'longitude' => $hub['longitude'],
                'is_default' => true,
            ],
        );
        if ($address->latitude === null || $address->longitude === null) {
            $address->forceFill([
                'latitude' => $hub['latitude'],
                'longitude' => $hub['longitude'],
            ])->save();
        }

        $organization = $logistics->logisticsOrganization()->firstOrCreate([], [
            'business_name' => 'Aisley '.(string) $hub['region'].' Logistics',
        ]);

        $organization->hub()->firstOrCreate([], [
            'address_id' => $address->id,
            'name' => 'Aisley '.(string) $hub['center'],
        ]);
    }
}
