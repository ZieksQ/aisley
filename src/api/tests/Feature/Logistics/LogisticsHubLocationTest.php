<?php

namespace Tests\Feature\Logistics;

use App\Enums\AddressType;
use App\Enums\UserRole;
use App\Enums\UserSex;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class LogisticsHubLocationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('logistics-registration-test');
        config()->set('logistics.registration.evidence_disk', 'logistics-registration-test');
    }

    public function test_registration_persists_a_complete_confirmed_coordinate_pair_on_the_sole_hub_address(): void
    {
        $this->post('/api/v1/logistics/auth/register', array_merge($this->registrationPayload(), [
            'latitude' => '14.565681',
            'longitude' => '121.032077',
        ]))->assertCreated();

        $user = User::query()->where('email', 'logistics-pin@example.com')->firstOrFail();
        $address = $user->addresses()->firstOrFail();
        $this->assertEqualsWithDelta(14.565681, (float) $address->getRawOriginal('latitude'), 0.0000001);
        $this->assertEqualsWithDelta(121.032077, (float) $address->getRawOriginal('longitude'), 0.0000001);
    }

    public function test_registration_rejects_partial_or_out_of_range_coordinates_without_creating_an_account(): void
    {
        $this->post('/api/v1/logistics/auth/register', array_merge($this->registrationPayload(), ['latitude' => '14.5']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('longitude');
        $this->assertDatabaseMissing('users', ['email' => 'logistics-pin@example.com']);

        $this->post('/api/v1/logistics/auth/register', array_merge($this->registrationPayload(), ['email' => 'logistics-pin-2@example.com', 'latitude' => '91', 'longitude' => '121']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('latitude');
        $this->assertDatabaseMissing('users', ['email' => 'logistics-pin-2@example.com']);
    }

    public function test_active_logistics_can_update_their_hub_pin_with_a_revision_and_a_reason(): void
    {
        $logistics = $this->logistics();
        $read = $this->actingAs($logistics)->getJson('/api/v1/logistics/account')->assertOk();
        $revision = $read->json('account.hub.location.expected_updated_at');

        $response = $this->putJson('/api/v1/logistics/account/hub-location', [
            'latitude' => 14.599512,
            'longitude' => 120.984222,
            'expected_updated_at' => $revision,
            'reason' => 'Corrected the pin to the loading entrance.',
        ])->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('message', 'Hub location updated successfully.')
            ->assertJsonPath('account.hub.location.latitude', 14.599512)
            ->assertJsonPath('account.hub.location.longitude', 120.984222)
            ->assertJsonPath('account.hub.address.address_line_1', '1 Hub Road');

        $this->assertNotSame($revision, $response->json('account.hub.location.expected_updated_at'));
        $this->assertDatabaseHas('addresses', [
            'id' => $logistics->logisticsOrganization()->firstOrFail()->hub()->firstOrFail()->address_id,
            'latitude' => 14.599512,
            'longitude' => 120.984222,
        ]);
        $this->assertDatabaseCount('logistics_hub_location_changes', 1);
        $this->assertDatabaseHas('logistics_hub_location_changes', [
            'actor_id' => $logistics->id,
            'latitude' => 14.599512,
            'longitude' => 120.984222,
            'reason' => 'Corrected the pin to the loading entrance.',
        ]);
    }

    public function test_stale_hub_pin_writes_are_rejected_and_leave_the_committed_location_unchanged(): void
    {
        $logistics = $this->logistics();
        $revision = $this->actingAs($logistics)->getJson('/api/v1/logistics/account')->json('account.hub.location.expected_updated_at');
        $this->putJson('/api/v1/logistics/account/hub-location', ['latitude' => 14.6, 'longitude' => 121.03, 'expected_updated_at' => $revision, 'reason' => 'First correction.'])->assertOk();

        $this->putJson('/api/v1/logistics/account/hub-location', ['latitude' => 15, 'longitude' => 122, 'expected_updated_at' => $revision, 'reason' => 'Stale correction.'])
            ->assertStatus(409)
            ->assertJsonPath('code', 'HUB_LOCATION_CONFLICT')
            ->assertJsonPath('data.current_location.latitude', 14.6);
        $this->assertDatabaseCount('logistics_hub_location_changes', 1);
    }

    public function test_hub_pin_update_rejects_unknown_fields_and_invalid_reasons(): void
    {
        $logistics = $this->logistics();
        $revision = $this->actingAs($logistics)->getJson('/api/v1/logistics/account')->json('account.hub.location.expected_updated_at');

        $this->putJson('/api/v1/logistics/account/hub-location', [
            'latitude' => 14.6,
            'longitude' => 121.03,
            'expected_updated_at' => $revision,
            'reason' => 'ok',
            'address_line_1' => 'Tampered',
        ])->assertUnprocessable()->assertJsonValidationErrors('address_line_1');
        $this->assertDatabaseCount('logistics_hub_location_changes', 0);
    }

    private function logistics(): User
    {
        $user = User::factory()->create([
            'email' => 'logistics-pin@example.com',
            'role' => UserRole::Logistics,
            'status' => UserStatus::Active,
            'password' => 'CurrentLogistics123',
        ]);
        $user->logisticsProfile()->create(['first_name' => 'Logan', 'last_name' => 'Operator', 'contact_number' => '09171234567', 'sex' => UserSex::Male, 'birth_date' => '1990-01-01']);
        $address = $user->addresses()->create(['type' => AddressType::Both, 'label' => 'Operational hub/sorting-center address', 'recipient_name' => 'Logan Operator', 'contact_number' => '09171234567', 'address_line_1' => '1 Hub Road', 'barangay' => 'Poblacion', 'city_municipality' => 'Makati City', 'province' => 'Metro Manila', 'region' => 'National Capital Region', 'postal_code' => '1200', 'country' => 'Philippines', 'is_default' => true]);
        $organization = $user->logisticsOrganization()->create(['business_name' => 'Aisley Delivery Services']);
        $organization->hub()->create(['address_id' => $address->id, 'name' => 'Aisley operational hub']);

        return $user;
    }

    /** @return array<string, mixed> */
    private function registrationPayload(): array
    {
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL2qAAAAABJRU5ErkJggg==', true);

        return ['first_name' => 'Logan', 'last_name' => 'Operator', 'middle_name' => 'A', 'contact_number' => '09171234567', 'sex' => 'male', 'birth_date' => '1990-01-01', 'business_name' => 'Aisley Delivery Services', 'email' => 'logistics-pin@example.com', 'password' => 'Password123', 'password_confirmation' => 'Password123', 'address' => ['address_line_1' => '1 Hub Road', 'barangay' => 'Poblacion', 'city_municipality' => 'Makati City', 'province' => 'Metro Manila', 'region' => 'National Capital Region', 'postal_code' => '1200'], 'government_id' => UploadedFile::fake()->createWithContent('id.png', $png), 'business_permit' => UploadedFile::fake()->createWithContent('permit.png', $png)];
    }
}
