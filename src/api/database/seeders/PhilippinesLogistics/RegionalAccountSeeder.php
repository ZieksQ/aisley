<?php

namespace Database\Seeders\PhilippinesLogistics;

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

class RegionalAccountSeeder
{
    public const PASSWORD = 'logistics123';

    public const COURIER_PASSWORD = 'courier123';

    public const COURIERS_PER_LOGISTICS = 5;

    /** @param array<string, string|float> $hub */
    public function seed(array $hub, int $number): LogisticsHub
    {
        $email = "logistics.{$hub['account']}@example.com";
        $contactNumber = sprintf('+63917030%04d', $number);
        $logistics = User::query()->firstOrCreate(
            ['email' => $email, 'role' => UserRole::Logistics],
            ['password' => self::PASSWORD, 'status' => UserStatus::Active, 'email_verified_at' => now()],
        );

        $logistics->logisticsProfile()->firstOrCreate([], [
            'first_name' => 'Regional',
            'last_name' => 'Logistics '.strtoupper((string) $hub['slug']),
            'contact_number' => $contactNumber,
            'sex' => UserSex::PreferNotToSay,
            'birth_date' => '1990-01-01',
        ]);

        $address = $logistics->addresses()->firstOrCreate(
            ['label' => $number <= 8 ? 'Luzon regional hub seed address' : 'Philippines regional hub seed address'],
            [
                'type' => AddressType::Both,
                'recipient_name' => 'Regional Logistics '.strtoupper((string) $hub['slug']),
                'contact_number' => $contactNumber,
                'address_line_1' => $hub['address_line_1'],
                'address_line_2' => 'Representative demo pin; see docs/philippines-logistics-seeding.md',
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
        $organization = $logistics->logisticsOrganization()->firstOrCreate([], [
            'business_name' => 'Aisley '.(string) $hub['region'].' Logistics',
        ]);

        $operationalHub = $organization->hub()->firstOrCreate([], [
            'address_id' => $address->id,
            'name' => 'Aisley '.$hub['city'].' regional hub',
        ]);

        $this->seedCouriers($organization, $operationalHub, $hub, $number);

        return $operationalHub;
    }

    /**
     * @param  array<string, string|float>  $hub
     */
    private function seedCouriers(LogisticsOrganization $organization, LogisticsHub $operationalHub, array $hub, int $logisticsNumber): void
    {
        for ($courierNumber = 1; $courierNumber <= self::COURIERS_PER_LOGISTICS; $courierNumber++) {
            $logisticsSequence = sprintf('%02d', $logisticsNumber);
            $courierSequence = sprintf('%02d', $courierNumber);
            $firstName = 'Regional';
            $lastName = sprintf('Courier %s-%s', $logisticsSequence, $courierSequence);
            $email = sprintf('courier.%s.%s@example.com', $hub['account'], $courierSequence);
            $contactNumber = sprintf('+63918%s%s01', $logisticsSequence, $courierSequence);

            $courier = User::query()->firstOrCreate(
                ['email' => $email, 'role' => UserRole::Courier],
                ['password' => self::COURIER_PASSWORD, 'status' => UserStatus::Active, 'email_verified_at' => now()],
            );
            $profile = $courier->courierProfile()->firstOrCreate([], [
                'first_name' => $firstName,
                'last_name' => $lastName,
                'middle_name' => null,
                'contact_number' => $contactNumber,
                'sex' => UserSex::PreferNotToSay,
                'birth_date' => '1995-01-01',
            ]);

            $courier->addresses()->firstOrCreate(['label' => $logisticsNumber <= 8 ? 'Luzon courier residence' : 'Philippines courier residence'], [
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
                'plate_number' => sprintf('PHR-%s-%s', $logisticsSequence, $courierSequence),
                'type' => $vehicle['type'],
                'status' => VehicleStatus::Active,
                'make' => $vehicle['make'],
                'model' => $vehicle['model'],
            ];
            if ($vehicleRecord === null) {
                $profile->vehicles()->create($vehicleAttributes);
            }

            $affiliation = $courier->courierLogisticsAffiliation()->firstOrNew();
            $shouldQualifyForCompanyTruck = $courierNumber <= 2;
            if (! $affiliation->exists) {
                $affiliation->fill([
                    'logistics_organization_id' => $organization->id,
                    'logistics_hub_id' => $operationalHub->id,
                    'status' => CourierAffiliationStatus::Approved,
                    'reviewer_id' => $organization->user_id,
                    'reviewed_at' => now(),
                    'rejection_reason' => null,
                    'can_drive_company_truck' => $shouldQualifyForCompanyTruck,
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
