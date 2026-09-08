<?php

namespace Tests\Feature\Courier;

use App\Enums\AddressType;
use App\Enums\CourierAffiliationStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CourierDashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_active_approved_courier_receives_a_private_truthful_dashboard_scaffold(): void
    {
        $courier = $this->courier();

        $response = $this->actingAs($courier)->getJson('/api/v1/courier/dashboard');

        $response->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data', [])
            ->assertJsonPath('meta.next_cursor', null)
            ->assertJsonPath('sections.notifications.state', 'unavailable')
            ->assertJsonPath('sections.notifications.reason', 'OPERATIONAL_SCHEMA_DEFERRED')
            ->assertJsonPath('sections.available_tasks.state', 'unavailable')
            ->assertJsonPath('sections.active_tasks.state', 'unavailable')
            ->assertJsonPath('freshness.state', 'scaffold')
            ->assertJsonPath('freshness.reason', 'OPERATIONAL_SCHEMA_DEFERRED')
            ->assertJsonMissingPath('orders')
            ->assertJsonMissingPath('courier.password');

        $this->assertNotNull($response->json('meta.generated_at'));
        $this->assertSame($response->json('meta.generated_at'), $response->json('freshness.generated_at'));
    }

    public function test_pending_courier_cannot_read_the_dashboard(): void
    {
        $courier = $this->courier(UserStatus::Pending);

        $this->actingAs($courier)
            ->getJson('/api/v1/courier/dashboard')
            ->assertForbidden()
            ->assertJsonPath('code', 'ACCOUNT_PENDING_APPROVAL');
    }

    public function test_non_courier_cannot_read_the_dashboard(): void
    {
        $customer = User::factory()->create([
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ]);

        $this->actingAs($customer)
            ->getJson('/api/v1/courier/dashboard')
            ->assertForbidden()
            ->assertJsonPath('code', 'FORBIDDEN_ROLE');
    }

    public function test_guest_cannot_read_the_dashboard(): void
    {
        $this->getJson('/api/v1/courier/dashboard')
            ->assertUnauthorized();
    }

    private function courier(UserStatus $status = UserStatus::Active): User
    {
        $logistics = User::factory()->create([
            'email' => fake()->unique()->safeEmail(),
            'role' => UserRole::Logistics,
            'status' => UserStatus::Active,
        ]);
        $logistics->logisticsProfile()->create([
            'first_name' => 'Logan',
            'last_name' => 'Operator',
            'contact_number' => '09171234567',
            'sex' => 'male',
            'birth_date' => '1990-01-01',
        ]);
        $address = $logistics->addresses()->create([
            'type' => AddressType::Both,
            'label' => 'Operational hub/sorting-center address',
            'recipient_name' => 'Logan Operator',
            'contact_number' => '09171234567',
            'address_line_1' => '1 Hub Road',
            'barangay' => 'Poblacion',
            'city_municipality' => 'Makati City',
            'province' => 'Metro Manila',
            'region' => 'National Capital Region',
            'postal_code' => '1200',
            'country' => 'Philippines',
            'is_default' => true,
        ]);
        $organization = $logistics->logisticsOrganization()->create([
            'business_name' => 'Aisley Delivery Services',
        ]);
        $hub = $organization->hub()->create([
            'address_id' => $address->id,
            'name' => 'Aisley Delivery Services operational hub',
        ]);

        $courier = User::factory()->create([
            'email' => fake()->unique()->safeEmail(),
            'role' => UserRole::Courier,
            'status' => $status,
        ]);
        $courier->courierProfile()->create([
            'first_name' => 'Cora',
            'last_name' => 'Rider',
            'contact_number' => '09171234568',
            'sex' => 'female',
            'birth_date' => '1994-06-15',
        ]);
        $courier->courierLogisticsAffiliation()->create([
            'logistics_organization_id' => $organization->id,
            'logistics_hub_id' => $hub->id,
            'status' => CourierAffiliationStatus::Approved,
        ]);

        return $courier;
    }
}
