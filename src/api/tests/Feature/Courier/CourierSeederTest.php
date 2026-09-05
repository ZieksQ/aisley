<?php

namespace Tests\Feature\Courier;

use App\Enums\CourierAffiliationStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Enums\VehicleStatus;
use App\Enums\VehicleType;
use App\Models\User;
use Database\Seeders\CourierSeeder;
use Database\Seeders\InitialLogisticsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CourierSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_courier_seeder_creates_one_configured_and_twenty_generic_accounts_idempotently(): void
    {
        config()->set('logistics.initial', [
            'email' => 'LOGISTICS@example.com',
            'password' => 'InitialLogistics123',
            'first_name' => 'Logan',
            'last_name' => 'Operator',
            'contact_number' => '+639171111112',
            'birth_date' => '1990-01-01',
            'business_name' => 'Aisley Delivery Services',
            'hub_name' => 'Aisley Makati Hub',
            'address_line_1' => '1 Hub Road',
            'address_line_2' => null,
            'barangay' => 'Poblacion',
            'city_municipality' => 'Makati City',
            'province' => 'Metro Manila',
            'region' => 'National Capital Region',
            'postal_code' => '1200',
        ]);
        config()->set('courier.initial', [
            'email' => ' LEAD-COURIER@example.com ',
            'password' => 'CourierSecret123',
            'first_name' => 'Cora',
            'last_name' => 'Rider',
            'middle_name' => 'M',
            'contact_number' => '+639171111113',
            'birth_date' => '1994-06-15',
            'vehicle_type' => VehicleType::Van->value,
            'plate_number' => 'LEAD-001',
            'address_line_1' => '2 Courier Avenue',
            'address_line_2' => 'Unit 4',
            'barangay' => 'Bel-Air',
            'city_municipality' => 'Makati City',
            'province' => 'Metro Manila',
            'region' => 'National Capital Region',
            'postal_code' => '1209',
            'logistics_email' => 'logistics@example.com',
        ]);
        config()->set('courier.generic', [
            'count' => 20,
            'email_prefix' => 'test-courier',
            'email_domain' => 'seed.example.com',
        ]);

        $this->seed(InitialLogisticsSeeder::class);
        $this->seed(CourierSeeder::class);

        $couriers = User::query()
            ->where('role', UserRole::Courier)
            ->with(['courierProfile.vehicles', 'addresses', 'courierLogisticsAffiliation'])
            ->get();

        $this->assertCount(21, $couriers);
        $this->assertSame(
            array_merge(
                ['lead-courier@example.com'],
                array_map(fn (int $number): string => sprintf('test-courier%02d@seed.example.com', $number), range(1, 20)),
            ),
            $couriers->pluck('email')->sort()->values()->all(),
        );
        $this->assertDatabaseCount('courier_profiles', 21);
        $this->assertDatabaseCount('vehicles', 21);
        $this->assertDatabaseCount('courier_logistics_affiliations', 21);

        $primary = $couriers->firstWhere('email', 'lead-courier@example.com');
        $this->assertNotNull($primary);
        $this->assertSame(UserStatus::Active, $primary->status);
        $this->assertTrue(Hash::check('CourierSecret123', $primary->password));
        $this->assertSame('Cora', $primary->courierProfile->first_name);
        $this->assertSame('Rider', $primary->courierProfile->last_name);
        $this->assertSame(VehicleType::Van, $primary->courierProfile->vehicles->first()->type);
        $this->assertSame(VehicleStatus::Active, $primary->courierProfile->vehicles->first()->status);
        $this->assertSame('Bel-Air', $primary->addresses->first()->barangay);
        $this->assertSame(CourierAffiliationStatus::Approved, $primary->courierLogisticsAffiliation->status);
        $this->assertSame('logistics@example.com', $primary->courierLogisticsAffiliation->organization->user->email);
        $this->assertNotNull($primary->courierLogisticsAffiliation->reviewed_at);

        $this->seed(CourierSeeder::class);

        $this->assertDatabaseCount('users', 22);
        $this->assertDatabaseCount('courier_profiles', 21);
        $this->assertDatabaseCount('vehicles', 21);
        $this->assertDatabaseCount('courier_logistics_affiliations', 21);
        $this->assertTrue(Hash::check('CourierSecret123', $primary->fresh()->password));
    }
}
