<?php

namespace Tests\Feature\Logistics;

use App\Enums\CourierAffiliationStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Enums\VehicleType;
use App\Http\Resources\Logistics\CourierAssignmentVehicleResource;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\LocalSortingFixtures;
use Tests\TestCase;

class CourierAssignmentVehicleTest extends TestCase
{
    use LocalSortingFixtures;
    use RefreshDatabase;

    private const ENDPOINTS = [
        '/api/v1/logistics/pickup-couriers',
        '/api/v1/logistics/dispatch/couriers',
    ];

    public function test_both_pickers_receive_only_safe_vehicle_identity_for_all_supported_types(): void
    {
        [$logistics, $organization, $hub] = $this->logistics();
        $expected = [];
        foreach (VehicleType::cases() as $type) {
            $courier = $this->courier($organization->id, $hub->id);
            $vehicle = $courier->courierProfile->vehicles()->create([
                'type' => $type,
                'plate_number' => 'PLATE-'.$type->value,
                'registration_document_path' => 'private/registration-secret.jpg',
            ]);
            $expected[$courier->id] = ['vehicle_type' => $type->value, 'plate_number' => $vehicle->plate_number];
        }
        $missingVehicle = $this->courier($organization->id, $hub->id);
        $expected[$missingVehicle->id] = null;

        foreach (self::ENDPOINTS as $endpoint) {
            $response = $this->actingAs($logistics)->getJson($endpoint)->assertOk()->assertJsonCount(5, 'data');
            $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
            foreach ($response->json('data') as $candidate) {
                $id = $candidate['courier_id'] ?? $candidate['id'];
                $this->assertSame($expected[$id], $candidate['vehicle']);
                $this->assertSame('09173333333', $candidate['contact_number']);
            }
            $this->assertStringNotContainsString('registration-secret', $response->getContent());
        }
    }

    public function test_vehicle_projection_preserves_tenant_and_approval_and_active_account_boundaries(): void
    {
        [$logistics, $organization, $hub] = $this->logistics();
        [, $foreignOrganization, $foreignHub] = $this->logistics();
        $eligible = $this->courier($organization->id, $hub->id);
        $foreign = $this->courier($foreignOrganization->id, $foreignHub->id);
        $pending = $this->courier($organization->id, $hub->id);
        $pending->courierLogisticsAffiliation()->update(['status' => CourierAffiliationStatus::Pending]);
        $inactive = $this->courier($organization->id, $hub->id);
        $inactive->update(['status' => UserStatus::Pending]);
        foreach ([$foreign, $pending, $inactive] as $courier) {
            $courier->courierProfile->vehicles()->create(['type' => VehicleType::Truck, 'plate_number' => 'HIDDEN-'.$courier->id]);
        }

        foreach (self::ENDPOINTS as $endpoint) {
            $candidate = $this->actingAs($logistics)->getJson($endpoint)->assertOk()->assertJsonCount(1, 'data')->json('data.0');
            $this->assertSame($eligible->id, $candidate['courier_id'] ?? $candidate['id']);
            $this->assertNull($candidate['vehicle']);
        }
    }

    public function test_unauthenticated_and_other_role_accounts_cannot_read_vehicle_candidates(): void
    {
        foreach (self::ENDPOINTS as $endpoint) {
            $this->getJson($endpoint)->assertUnauthorized();
        }
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        foreach (self::ENDPOINTS as $endpoint) {
            $this->actingAs($customer)->getJson($endpoint)->assertForbidden();
        }
    }

    public function test_missing_profiles_and_ambiguous_legacy_vehicles_do_not_select_an_arbitrary_vehicle(): void
    {
        $this->assertNull(CourierAssignmentVehicleResource::forProfile(null));
        [, $organization, $hub] = $this->logistics();
        $profile = $this->courier($organization->id, $hub->id)->courierProfile;
        $profile->setRelation('vehicles', new Collection([
            new Vehicle(['type' => VehicleType::Truck, 'plate_number' => 'TRUCK']),
            new Vehicle(['type' => VehicleType::Motorcycle, 'plate_number' => 'MOTORCYCLE']),
        ]));
        $this->assertNull(CourierAssignmentVehicleResource::forProfile($profile));
    }
}
