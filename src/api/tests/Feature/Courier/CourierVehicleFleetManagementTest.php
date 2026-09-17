<?php

namespace Tests\Feature\Courier;

use App\Enums\AddressType;
use App\Enums\CourierAffiliationStatus;
use App\Enums\UserRole;
use App\Enums\UserSex;
use App\Enums\UserStatus;
use App\Enums\VehicleStatus;
use App\Enums\VehicleType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CourierVehicleFleetManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('courier-vehicle-test');
        config()->set('courier.registration.evidence_disk', 'courier-vehicle-test');
    }

    public function test_courier_can_read_and_update_their_sole_vehicle_idempotently(): void
    {
        [$courier, $logistics] = $this->courierPair();

        $this->actingAs($courier)
            ->getJson('/api/v1/courier/vehicle')
            ->assertOk()
            ->assertJsonPath('data.vehicle_type', 'motorcycle')
            ->assertJsonPath('data.revision', 1)
            ->assertJsonPath('data.official_receipt', null);

        $key = '01b21d7a-3a6a-4e75-91cb-3f4a4e601111';
        $payload = ['expected_revision' => 1, 'vehicle_type' => 'car', 'make' => 'Aisley Motors'];
        $response = $this->actingAs($courier)->withHeader('Idempotency-Key', $key)
            ->patchJson('/api/v1/courier/vehicle', $payload)
            ->assertOk()
            ->assertJsonPath('data.vehicle_type', 'car')
            ->assertJsonPath('data.make', 'Aisley Motors')
            ->assertJsonPath('data.revision', 2);

        $this->actingAs($courier)->withHeader('Idempotency-Key', $key)
            ->patchJson('/api/v1/courier/vehicle', $payload)
            ->assertOk()
            ->assertJsonPath('data.revision', 2);
        $this->assertDatabaseCount('courier_vehicle_mutations', 1);
        $this->assertDatabaseCount('notifications', 1);
        $notificationData = (string) DB::table('notifications')->value('data');
        $this->assertStringNotContainsString('TEST-ONE', $notificationData);
        $this->assertStringNotContainsString('Aisley Motors', $notificationData);
        $this->assertStringContainsString('vehicle_type', $notificationData);

        $this->actingAs($courier)->withHeader('Idempotency-Key', $key)
            ->patchJson('/api/v1/courier/vehicle', ['expected_revision' => 2, 'vehicle_type' => 'van'])
            ->assertConflict()
            ->assertJsonPath('code', 'IDEMPOTENCY_KEY_REUSED');
        $this->actingAs($courier)->withHeader('Idempotency-Key', '01b21d7a-3a6a-4e75-91cb-3f4a4e602222')
            ->patchJson('/api/v1/courier/vehicle', ['expected_revision' => 1, 'vehicle_type' => 'van'])
            ->assertConflict()
            ->assertJsonPath('code', 'VEHICLE_REVISION_STALE');
        $this->assertNotNull($response->json('data.id'));
        $this->assertSame(VehicleType::Car, $courier->courierProfile->vehicles()->first()->fresh()->type);
        $this->assertSame(UserStatus::Active, $logistics->fresh()->status);
    }

    public function test_plate_numbers_are_globally_unique_and_logistics_can_only_read_its_affiliated_courier(): void
    {
        [$courier, $logistics] = $this->courierPair('first@example.com', 'logistics-one@example.com');
        [$other, $otherLogistics] = $this->courierPair('other@example.com', 'logistics-two@example.com');
        $plate = $other->courierProfile->vehicles()->first()->plate_number;

        $this->actingAs($courier)->withHeader('Idempotency-Key', '01b21d7a-3a6a-4e75-91cb-3f4a4e603333')
            ->patchJson('/api/v1/courier/vehicle', ['expected_revision' => 1, 'plate_number' => $plate])
            ->assertConflict()
            ->assertJsonPath('code', 'PLATE_NUMBER_TAKEN');

        $this->actingAs($logistics)->getJson('/api/v1/logistics/couriers/'.$courier->id.'/vehicle')
            ->assertOk()
            ->assertJsonPath('data.plate_number', $courier->courierProfile->vehicles->first()->plate_number)
            ->assertJsonPath('data.revision', 1);
        $this->actingAs($otherLogistics)->getJson('/api/v1/logistics/couriers/'.$courier->id.'/vehicle')->assertNotFound();
    }

    public function test_logistics_vehicle_list_is_bounded_scoped_and_contains_no_private_media(): void
    {
        [$courier, $logistics] = $this->courierPair('first@example.com', 'fleet-logistics@example.com');
        $second = $this->additionalCourier($logistics, 'second@example.com', 'FLEET-TWO');
        $pending = $this->additionalCourier($logistics, 'pending@example.com', 'FLEET-PENDING', CourierAffiliationStatus::Pending);
        $suspended = $this->additionalCourier($logistics, 'suspended@example.com', 'FLEET-SUSPENDED');
        $suspended->update(['status' => UserStatus::Suspended]);
        [$foreign] = $this->courierPair('foreign@example.com', 'other-fleet@example.com');

        $this->getJson('/api/v1/logistics/vehicles')->assertUnauthorized();
        $this->actingAs($courier)->getJson('/api/v1/logistics/vehicles')->assertForbidden();

        $response = $this->actingAs($logistics)->getJson('/api/v1/logistics/vehicles?per_page=1&page=1')
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('meta.last_page', 2);
        $this->assertNotNull($response->json('links.next'));
        $this->assertStringNotContainsString('documents/', $response->getContent());
        $this->assertStringNotContainsString('registration_document_path', $response->getContent());

        $this->actingAs($logistics)->getJson('/api/v1/logistics/vehicles?search=FLEET-TWO')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.courier.id', $second->id)
            ->assertJsonPath('data.0.vehicle.plate_number', 'FLEET-TWO')
            ->assertJsonPath('data.0.vehicle.official_receipt_uploaded', false);
        $this->actingAs($logistics)->getJson('/api/v1/logistics/vehicles?search='.$foreign->email)
            ->assertOk()->assertJsonPath('meta.total', 0);
        $this->actingAs($logistics)->getJson('/api/v1/logistics/vehicles?search=FLEET-PENDING')
            ->assertOk()->assertJsonPath('meta.total', 0);
        $this->actingAs($logistics)->getJson('/api/v1/logistics/vehicles?search=%25')
            ->assertOk()->assertJsonPath('meta.total', 0);
        $this->assertNotSame($pending->id, $second->id);
    }

    public function test_logistics_vehicle_list_validates_pagination_and_stable_order(): void
    {
        [$courier, $logistics] = $this->courierPair('older@example.com', 'ordering-logistics@example.com');
        $second = $this->additionalCourier($logistics, 'newer@example.com', 'FLEET-NEWER');
        $courier->courierProfile->vehicles()->first()->forceFill(['created_at' => now()->subDay()])->save();

        $this->actingAs($logistics)->getJson('/api/v1/logistics/vehicles?per_page=1&page=1')
            ->assertOk()->assertJsonPath('data.0.courier.id', $second->id);
        $this->actingAs($logistics)->getJson('/api/v1/logistics/vehicles?per_page=1&page=2')
            ->assertOk()->assertJsonPath('data.0.courier.id', $courier->id);
        $this->actingAs($logistics)->getJson('/api/v1/logistics/vehicles?per_page=51')
            ->assertUnprocessable()->assertJsonValidationErrors('per_page');
        $this->actingAs($logistics)->getJson('/api/v1/logistics/vehicles?page=0')
            ->assertUnprocessable()->assertJsonValidationErrors('page');
    }

    public function test_courier_can_replace_or_and_cr_independently_and_documents_are_private(): void
    {
        [$courier, $logistics] = $this->courierPair();
        $orKey = '01b21d7a-3a6a-4e75-91cb-3f4a4e604444';
        $this->actingAs($courier)->withHeader('Idempotency-Key', $orKey)
            ->post('/api/v1/courier/vehicle/documents/official_receipt', [
                'expected_revision' => 1,
                'file' => UploadedFile::fake()->createWithContent('or.png', $this->png()),
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.revision', 2)
            ->assertJsonPath('data.official_receipt.id', fn ($id) => is_string($id));
        $or = $courier->courierProfile->vehicles()->first()->fresh()->officialReceiptDocument;
        Storage::disk('courier-vehicle-test')->assertExists($or->path);
        $this->actingAs($courier)->get('/api/v1/courier/vehicle/documents/official_receipt')
            ->assertOk()
            ->assertHeader('Content-Type', 'image/png')
            ->assertHeader('Cache-Control', 'no-store, private');

        $this->actingAs($logistics)->getJson('/api/v1/logistics/couriers/'.$courier->id.'/vehicle')
            ->assertOk()
            ->assertJsonPath('data.official_receipt.url', '/api/v1/logistics/couriers/'.$courier->id.'/vehicle/documents/official_receipt');
        $this->actingAs($logistics)->get('/api/v1/logistics/couriers/'.$courier->id.'/vehicle/documents/official_receipt')
            ->assertOk()
            ->assertHeader('Content-Type', 'image/png');
        $this->actingAs($courier)->withHeader('Idempotency-Key', '01b21d7a-3a6a-4e75-91cb-3f4a4e605555')
            ->post('/api/v1/courier/vehicle/documents/certificate_of_registration', [
                'expected_revision' => 2,
                'file' => UploadedFile::fake()->createWithContent('cr.png', $this->png()),
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.revision', 3)
            ->assertJsonPath('data.official_receipt.id', $or->id)
            ->assertJsonPath('data.certificate_of_registration.id', fn ($id) => is_string($id));
        $this->assertDatabaseCount('notifications', 2);
        $this->assertStringNotContainsString('courier-vehicle-test', $this->getJson('/api/v1/courier/vehicle')->getContent());
    }

    /** @return array{0: User, 1: User} */
    private function courierPair(string $courierEmail = 'courier@example.com', string $logisticsEmail = 'logistics@example.com'): array
    {
        $logistics = User::factory()->create(['email' => $logisticsEmail, 'role' => UserRole::Logistics, 'status' => UserStatus::Active]);
        $logistics->logisticsProfile()->create(['first_name' => 'Logan', 'last_name' => 'Operator', 'contact_number' => '09171234567', 'sex' => UserSex::Male, 'birth_date' => '1990-01-01']);
        $address = $logistics->addresses()->create(['type' => AddressType::Both, 'label' => 'Hub', 'recipient_name' => 'Logan Operator', 'contact_number' => '09171234567', 'address_line_1' => '1 Hub Road', 'barangay' => 'Poblacion', 'city_municipality' => 'Makati City', 'province' => 'Metro Manila', 'region' => 'National Capital Region', 'postal_code' => '1200', 'country' => 'Philippines', 'is_default' => true]);
        $organization = $logistics->logisticsOrganization()->create(['business_name' => $logisticsEmail.' org']);
        $hub = $organization->hub()->create(['address_id' => $address->id, 'name' => 'Hub']);
        $courier = User::factory()->create(['email' => $courierEmail, 'role' => UserRole::Courier, 'status' => UserStatus::Active]);
        $profile = $courier->courierProfile()->create(['first_name' => 'Cora', 'last_name' => 'Rider', 'contact_number' => '09171234568', 'sex' => UserSex::Female, 'birth_date' => '1994-06-15']);
        $courier->courierLogisticsAffiliation()->create(['logistics_organization_id' => $organization->id, 'logistics_hub_id' => $hub->id, 'status' => CourierAffiliationStatus::Approved]);
        $profile->vehicles()->create(['plate_number' => $courierEmail === 'courier@example.com' ? 'TEST-ONE' : 'TEST-'.strtoupper(substr(md5($courierEmail), 0, 6)), 'type' => VehicleType::Motorcycle, 'status' => VehicleStatus::Active]);

        return [$courier->fresh(['courierProfile.vehicles']), $logistics];
    }

    private function additionalCourier(User $logistics, string $email, string $plate, CourierAffiliationStatus $affiliationStatus = CourierAffiliationStatus::Approved): User
    {
        $organization = $logistics->logisticsOrganization()->with('hub')->firstOrFail();
        $courier = User::factory()->create(['email' => $email, 'role' => UserRole::Courier, 'status' => UserStatus::Active]);
        $profile = $courier->courierProfile()->create(['first_name' => 'Cora', 'last_name' => 'Rider', 'contact_number' => '09171234568', 'sex' => UserSex::Female, 'birth_date' => '1994-06-15']);
        $courier->courierLogisticsAffiliation()->create(['logistics_organization_id' => $organization->id, 'logistics_hub_id' => $organization->hub->id, 'status' => $affiliationStatus]);
        $profile->vehicles()->create(['plate_number' => $plate, 'type' => VehicleType::Motorcycle, 'status' => VehicleStatus::Active]);

        return $courier;
    }

    private function png(): string
    {
        return base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true);
    }
}
