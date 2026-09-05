<?php

namespace Tests\Feature\Logistics;

use App\Enums\AddressType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class LogisticsAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('logistics-registration-test');
        config()->set('logistics.registration.evidence_disk', 'logistics-registration-test');
    }

    public function test_registration_creates_one_pending_logistics_account_organization_hub_and_evidence(): void
    {
        $this->post('/api/v1/logistics/auth/register', $this->payload())
            ->assertCreated()
            ->assertJsonPath('logistics.role', UserRole::Logistics->value)
            ->assertJsonPath('logistics.status', UserStatus::Pending->value)
            ->assertJsonPath('logistics.organization.business_name', 'Aisley Delivery Services');

        $user = User::query()->where('email', 'logistics@example.com')->where('role', UserRole::Logistics)->firstOrFail();
        $this->assertDatabaseHas('logistics_profiles', ['user_id' => $user->id, 'first_name' => 'Logan']);
        $this->assertDatabaseHas('logistics_organizations', ['user_id' => $user->id, 'business_name' => 'Aisley Delivery Services']);
        $this->assertDatabaseCount('logistics_hubs', 1);
        $this->assertDatabaseCount('documents', 2);
        $this->assertGuest();
    }

    public function test_only_active_logistics_accounts_can_establish_a_session_and_read_the_hub_scaffold(): void
    {
        $user = $this->logistics(UserStatus::Active);
        $this->fromLogisticsApp()->postJson('/api/v1/logistics/auth/login', ['email' => $user->email, 'password' => 'password', 'remember' => false])
            ->assertOk()->assertJsonPath('logistics.id', $user->id);
        $this->getJson('/api/v1/logistics/dashboard')
            ->assertOk()->assertJsonPath('hub.name', 'Aisley Delivery Services operational hub')->assertJsonPath('freshness.state', 'scaffold');
    }

    public function test_pending_and_wrong_role_accounts_cannot_access_logistics_dashboard(): void
    {
        $pending = $this->logistics(UserStatus::Pending);
        $this->actingAs($pending)->getJson('/api/v1/logistics/dashboard')->assertForbidden()->assertJsonPath('code', 'ACCOUNT_PENDING_APPROVAL');
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $this->actingAs($customer)->getJson('/api/v1/logistics/dashboard')->assertForbidden()->assertJsonPath('code', 'FORBIDDEN_ROLE');
    }

    private function logistics(UserStatus $status): User
    {
        $user = User::factory()->create(['email' => fake()->unique()->safeEmail(), 'role' => UserRole::Logistics, 'status' => $status, 'password' => 'password']);
        $user->logisticsProfile()->create(['first_name' => 'Logan', 'last_name' => 'Operator', 'contact_number' => '09171234567', 'sex' => 'male', 'birth_date' => '1990-01-01']);
        $address = $user->addresses()->create(['type' => AddressType::Both, 'label' => 'Operational hub/sorting-center address', 'recipient_name' => 'Logan Operator', 'contact_number' => '09171234567', 'address_line_1' => '1 Hub Road', 'barangay' => 'Poblacion', 'city_municipality' => 'Makati City', 'province' => 'Metro Manila', 'region' => 'National Capital Region', 'postal_code' => '1200', 'country' => 'Philippines', 'is_default' => true]);
        $organization = $user->logisticsOrganization()->create(['business_name' => 'Aisley Delivery Services']);
        $organization->hub()->create(['address_id' => $address->id, 'name' => 'Aisley Delivery Services operational hub']);

        return $user;
    }

    private function payload(): array
    {
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL2qAAAAABJRU5ErkJggg==', true);

        return ['first_name' => 'Logan', 'last_name' => 'Operator', 'middle_name' => 'A', 'contact_number' => '09171234567', 'sex' => 'male', 'birth_date' => '1990-01-01', 'business_name' => 'Aisley Delivery Services', 'email' => 'Logistics@Example.com', 'password' => 'Password123', 'password_confirmation' => 'Password123', 'address' => ['address_line_1' => '1 Hub Road', 'barangay' => 'Poblacion', 'city_municipality' => 'Makati City', 'province' => 'Metro Manila', 'region' => 'National Capital Region', 'postal_code' => '1200'], 'government_id' => UploadedFile::fake()->createWithContent('id.png', $png), 'business_permit' => UploadedFile::fake()->createWithContent('permit.png', $png)];
    }

    private function fromLogisticsApp(): self
    {
        return $this->withHeader('Origin', 'http://localhost:5176');
    }
}
