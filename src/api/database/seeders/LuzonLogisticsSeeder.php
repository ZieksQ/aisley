<?php

namespace Database\Seeders;

use App\Enums\AddressType;
use App\Enums\CourierAffiliationStatus;
use App\Enums\UserRole;
use App\Enums\UserSex;
use App\Enums\UserStatus;
use App\Enums\VehicleStatus;
use App\Enums\VehicleType;
use App\Models\LogisticsHub;
use App\Models\LogisticsOrganization;
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

    private const COURIER_PASSWORD = 'courier123';

    private const COURIERS_PER_LOGISTICS = 5;

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

        $operationalHub = $organization->hub()->firstOrCreate([], [
            'address_id' => $address->id,
            'name' => 'Aisley '.(string) $hub['center'],
        ]);

        $this->seedCouriers($organization, $operationalHub, $hub, $number);
    }

    /**
     * @param  array<string, string|float>  $hub
     */
    private function seedCouriers(LogisticsOrganization $organization, LogisticsHub $operationalHub, array $hub, int $logisticsNumber): void
    {
        for ($courierNumber = 1; $courierNumber <= self::COURIERS_PER_LOGISTICS; $courierNumber++) {
            $logisticsSequence = sprintf('%02d', $logisticsNumber);
            $courierSequence = sprintf('%02d', $courierNumber);
            $firstName = 'Luzon';
            $lastName = sprintf('Courier %s-%s', $logisticsSequence, $courierSequence);
            $email = sprintf('courier.luzon%s.%s@example.com', $logisticsSequence, $courierSequence);
            $contactNumber = sprintf('+63918%s%s01', $logisticsSequence, $courierSequence);

            $courier = User::query()->firstOrCreate(
                ['email' => $email, 'role' => UserRole::Courier],
                ['password' => self::COURIER_PASSWORD, 'status' => UserStatus::Active, 'email_verified_at' => now()],
            );
            if ($courier->status !== UserStatus::Active || $courier->email_verified_at === null) {
                $courier->forceFill(['status' => UserStatus::Active, 'email_verified_at' => $courier->email_verified_at ?? now()])->save();
            }

            $profile = $courier->courierProfile()->firstOrCreate([], [
                'first_name' => $firstName,
                'last_name' => $lastName,
                'middle_name' => null,
                'contact_number' => $contactNumber,
                'sex' => UserSex::PreferNotToSay,
                'birth_date' => '1995-01-01',
            ]);

            $courier->addresses()->firstOrCreate(['label' => 'Luzon courier residence'], [
                'type' => AddressType::Both,
                'recipient_name' => trim($firstName.' '.$lastName),
                'contact_number' => $contactNumber,
                'address_line_1' => sprintf('%s courier residence %s', (string) $hub['city'], $courierSequence),
                'address_line_2' => null,
                'barangay' => $hub['barangay'],
                'city_municipality' => $hub['city'],
                'province' => $hub['province'],
                'region' => $hub['region'],
                'postal_code' => $hub['postal_code'],
                'country' => 'Philippines',
                'is_default' => true,
            ]);

            $vehicle = $this->vehicleDetails($courierNumber);
            $vehicleRecord = $profile->vehicles()->first();
            $vehicleAttributes = [
                'plate_number' => sprintf('LZN-%s-%s', $logisticsSequence, $courierSequence),
                'type' => $vehicle['type'],
                'status' => VehicleStatus::Active,
                'make' => $vehicle['make'],
                'model' => $vehicle['model'],
            ];
            if ($vehicleRecord === null) {
                $profile->vehicles()->create($vehicleAttributes);
            } else {
                $vehicleRecord->forceFill($vehicleAttributes)->save();
            }

            $affiliation = $courier->courierLogisticsAffiliation()->firstOrNew();
            $requiresApproval = ! $affiliation->exists
                || $affiliation->logistics_organization_id !== $organization->id
                || $affiliation->logistics_hub_id !== $operationalHub->id
                || $affiliation->status !== CourierAffiliationStatus::Approved
                || $affiliation->reviewer_id !== $organization->user_id
                || $affiliation->reviewed_at === null;

            if ($requiresApproval) {
                $affiliation->fill([
                    'logistics_organization_id' => $organization->id,
                    'logistics_hub_id' => $operationalHub->id,
                    'status' => CourierAffiliationStatus::Approved,
                    'reviewer_id' => $organization->user_id,
                    'reviewed_at' => now(),
                    'rejection_reason' => null,
                ])->save();
            }
        }
    }

    /**
     * @return array{type: VehicleType, make: string, model: string}
     */
    private function vehicleDetails(int $courierNumber): array
    {
        return match ($courierNumber) {
            1 => ['type' => VehicleType::Motorcycle, 'make' => 'Honda', 'model' => 'Click 160'],
            2 => ['type' => VehicleType::Motorcycle, 'make' => 'Yamaha', 'model' => 'NMAX'],
            3 => ['type' => VehicleType::Car, 'make' => 'Toyota', 'model' => 'Vios'],
            4 => ['type' => VehicleType::Van, 'make' => 'Suzuki', 'model' => 'APV'],
            default => ['type' => VehicleType::Motorcycle, 'make' => 'Kymco', 'model' => 'Like 150i'],
        };
    }
}
