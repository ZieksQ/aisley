<?php

namespace Tests\Feature\Admin;

use App\Enums\AddressType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AdminProfile;
use App\Models\Permission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class HubRoutingConfigurationTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_configuration_requires_permissions_and_preserves_hub_scoped_coverage_and_directions(): void
    {
        $this->getJson('/api/v1/admin/hub-routing/service-areas')->assertUnauthorized();
        [$logistics, , $a] = $this->logistics();
        [, , $b] = $this->logistics();
        $this->actingAs($logistics)->postJson('/api/v1/admin/hub-routing/service-areas', [])->assertForbidden();
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        AdminProfile::create(['user_id' => $admin->id, 'first_name' => 'Routing', 'last_name' => 'Admin', 'is_initial_admin' => false]);
        $this->actingAs($admin)->getJson('/api/v1/admin/hub-routing/service-areas')->assertForbidden();
        foreach (['platform-settings.view', 'platform-settings.manage'] as $slug) {
            $permission = Permission::firstOrCreate(['slug' => $slug], ['name' => $slug, 'description' => $slug]);
            $admin->permissions()->attach($permission);
        }
        $area = $this->postJson('/api/v1/admin/hub-routing/service-areas', ['logistics_hub_id' => $a->id, 'postal_code' => '60-00'])->assertCreated()->assertJsonPath('data.postal_code', '6000')->json('data');
        $this->postJson('/api/v1/admin/hub-routing/service-areas', ['logistics_hub_id' => $b->id, 'postal_code' => '6000'])->assertCreated();
        $this->postJson('/api/v1/admin/hub-routing/service-areas', ['logistics_hub_id' => $a->id, 'postal_code' => '6000'])->assertConflict();
        $this->patchJson('/api/v1/admin/hub-routing/service-areas/'.$area['id'], ['expected_revision' => 99, 'is_active' => false])->assertConflict();
        $this->patchJson('/api/v1/admin/hub-routing/service-areas/'.$area['id'], ['expected_revision' => 1, 'is_active' => false])->assertOk()->assertJsonPath('data.revision', 2);
        $this->patchJson('/api/v1/admin/hub-routing/service-areas/'.$area['id'], ['expected_revision' => 2, 'is_active' => true])->assertOk();
        $connection = $this->postJson('/api/v1/admin/hub-routing/connections', ['from_hub_id' => $a->id, 'to_hub_id' => $b->id])->assertCreated()->json('data');
        $this->postJson('/api/v1/admin/hub-routing/connections', ['from_hub_id' => $a->id, 'to_hub_id' => $b->id])->assertConflict();
        $this->postJson('/api/v1/admin/hub-routing/connections', ['from_hub_id' => $b->id, 'to_hub_id' => $a->id])->assertCreated();
        $this->postJson('/api/v1/admin/hub-routing/connections', ['from_hub_id' => $a->id, 'to_hub_id' => $a->id])->assertUnprocessable();
        $this->patchJson('/api/v1/admin/hub-routing/connections/'.$connection['id'], ['expected_revision' => 1, 'is_active' => false, 'to_hub_id' => $a->id])->assertUnprocessable();
        $this->getJson('/api/v1/admin/hub-routing/connections')->assertOk()->assertJsonCount(2, 'data');
        $this->assertDatabaseHas('audit_outbox', ['action' => 'platform_settings.hub_routing_configuration_updated']);
    }

    private function logistics(): array
    {
        $user = User::factory()->create(['role' => UserRole::Logistics, 'status' => UserStatus::Active]);
        $address = $user->addresses()->create(['type' => AddressType::Both, 'label' => 'Hub', 'recipient_name' => 'Operator', 'contact_number' => '09172222222', 'address_line_1' => '1 Hub Road', 'barangay' => 'Poblacion', 'city_municipality' => 'Manila', 'province' => 'Metro Manila', 'region' => 'NCR', 'postal_code' => '1000', 'country' => 'PH', 'is_default' => true]);
        $organization = $user->logisticsOrganization()->create(['business_name' => 'Aisley Logistics']);
        $hub = $organization->hub()->create(['address_id' => $address->id, 'name' => 'Aisley Hub']);

        return [$user, $organization, $hub];
    }
}
