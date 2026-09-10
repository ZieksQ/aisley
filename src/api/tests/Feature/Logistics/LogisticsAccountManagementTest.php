<?php

namespace Tests\Feature\Logistics;

use App\Enums\AddressType;
use App\Enums\UserRole;
use App\Enums\UserSex;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class LogisticsAccountManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_an_active_logistics_account_can_read_its_private_projection(): void
    {
        $this->getJson('/api/v1/logistics/account')->assertUnauthorized();

        $customer = User::factory()->create([
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ]);
        $this->actingAs($customer)
            ->getJson('/api/v1/logistics/account')
            ->assertForbidden()
            ->assertJsonPath('code', 'FORBIDDEN_ROLE');

        $logistics = $this->logistics();
        $this->actingAs($logistics)
            ->getJson('/api/v1/logistics/account')
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertHeader('Pragma', 'no-cache')
            ->assertJsonPath('account.id', $logistics->id)
            ->assertJsonPath('account.email', 'logistics@example.com')
            ->assertJsonPath('account.role', 'logistics')
            ->assertJsonPath('account.status', 'active')
            ->assertJsonPath('account.profile.first_name', 'Logan')
            ->assertJsonPath('account.profile.middle_name', 'A')
            ->assertJsonPath('account.profile.last_name', 'Operator')
            ->assertJsonPath('account.profile.sex', 'male')
            ->assertJsonPath('account.organization.business_name', 'Aisley Delivery Services')
            ->assertJsonPath('account.hub.name', 'Aisley operational hub')
            ->assertJsonPath('account.hub.address.postal_code', '1200')
            ->assertJsonPath('account.security.email_editable', false)
            ->assertJsonPath('account.security.hub_address_editable', false)
            ->assertJsonMissingPath('account.password')
            ->assertJsonMissingPath('account.organization.courier_affiliations');
    }

    public function test_pending_accounts_and_missing_foundation_relationships_fail_closed(): void
    {
        $pending = $this->logistics('pending@example.com', UserStatus::Pending);
        $this->actingAs($pending)
            ->getJson('/api/v1/logistics/account')
            ->assertForbidden()
            ->assertJsonPath('code', 'ACCOUNT_PENDING_APPROVAL');

        $missingOrganization = User::factory()->create([
            'role' => UserRole::Logistics,
            'status' => UserStatus::Active,
        ]);
        $missingOrganization->logisticsProfile()->create([
            'first_name' => 'Missing',
            'last_name' => 'Organization',
            'contact_number' => '09170000000',
            'sex' => UserSex::PreferNotToSay,
            'birth_date' => '1990-01-01',
        ]);

        $this->actingAs($missingOrganization)
            ->getJson('/api/v1/logistics/account')
            ->assertNotFound();

        $missingHub = $this->logistics('missing-hub@example.com');
        $missingHub->logisticsOrganization()->firstOrFail()->hub()->delete();
        $this->actingAs($missingHub)
            ->getJson('/api/v1/logistics/account')
            ->assertNotFound();
    }

    public function test_logistics_can_update_allow_listed_profile_fields_and_get_the_latest_projection(): void
    {
        $logistics = $this->logistics();

        $this->actingAs($logistics)
            ->patchJson('/api/v1/logistics/account/profile', [
                'first_name' => '  Lina ',
                'middle_name' => '   ',
                'contact_number' => ' 09179999999 ',
                'sex' => 'female',
                'birth_date' => '1992-05-10',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Profile updated successfully.')
            ->assertJsonPath('account.profile.first_name', 'Lina')
            ->assertJsonPath('account.profile.middle_name', null)
            ->assertJsonPath('account.profile.last_name', 'Operator')
            ->assertJsonPath('account.profile.contact_number', '09179999999')
            ->assertJsonPath('account.profile.sex', 'female')
            ->assertJsonPath('account.profile.birth_date', '1992-05-10');

        $this->patchJson('/api/v1/logistics/account/profile', ['last_name' => 'Committed'])
            ->assertOk()
            ->assertJsonPath('account.profile.first_name', 'Lina')
            ->assertJsonPath('account.profile.last_name', 'Committed');

        $profile = $logistics->logisticsProfile()->firstOrFail();
        $this->assertSame('Lina', $profile->first_name);
        $this->assertSame('Committed', $profile->last_name);
        $this->assertNull($profile->middle_name);
        $this->assertSame('09179999999', $profile->contact_number);
        $this->assertSame(UserSex::Female, $profile->sex);
        $this->assertSame('1992-05-10', $profile->birth_date?->toDateString());
    }

    public function test_profile_updates_reject_unknown_or_immutable_fields_without_partial_writes(): void
    {
        $logistics = $this->logistics();

        $this->actingAs($logistics)
            ->patchJson('/api/v1/logistics/account/profile', [
                'first_name' => 'Tampered',
                'email' => 'changed@example.com',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        $this->assertDatabaseHas('logistics_profiles', [
            'user_id' => $logistics->id,
            'first_name' => 'Logan',
        ]);
        $this->assertDatabaseHas('users', [
            'id' => $logistics->id,
            'email' => 'logistics@example.com',
        ]);

        $this->patchJson('/api/v1/logistics/account/profile', [
            'sex' => 'not-a-sex',
            'birth_date' => now()->addDay()->toDateString(),
        ])->assertUnprocessable()->assertJsonValidationErrors(['sex', 'birth_date']);
    }

    public function test_logistics_can_update_organization_and_hub_name_but_not_the_hub_address(): void
    {
        $logistics = $this->logistics();
        $hub = $logistics->logisticsOrganization()->firstOrFail()->hub()->firstOrFail();
        $addressId = $hub->address_id;

        $this->actingAs($logistics)
            ->patchJson('/api/v1/logistics/account/organization', [
                'business_name' => '  New Logistics Co. ',
                'hub_name' => '  North sorting center ',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Organization details updated successfully.')
            ->assertJsonPath('account.organization.business_name', 'New Logistics Co.')
            ->assertJsonPath('account.hub.name', 'North sorting center')
            ->assertJsonPath('account.hub.address.postal_code', '1200');

        $this->assertDatabaseHas('logistics_organizations', [
            'id' => $logistics->logisticsOrganization()->value('id'),
            'business_name' => 'New Logistics Co.',
        ]);
        $this->assertDatabaseHas('logistics_hubs', [
            'id' => $hub->id,
            'name' => 'North sorting center',
            'address_id' => $addressId,
        ]);

        $this->patchJson('/api/v1/logistics/account/organization', [
            'address_id' => '00000000-0000-0000-0000-000000000000',
        ])->assertUnprocessable()->assertJsonValidationErrors('address_id');
        $this->assertDatabaseHas('logistics_hubs', ['id' => $hub->id, 'address_id' => $addressId]);
    }

    public function test_password_change_requires_current_password_and_revokes_all_bearer_tokens(): void
    {
        $logistics = $this->logistics();
        $first = $logistics->createToken('browser');
        $second = $logistics->createToken('mobile');

        $this->withToken($first->plainTextToken)
            ->putJson('/api/v1/logistics/account/password', [
                'current_password' => 'wrong-password',
                'password' => 'UpdatedLogistics456',
                'password_confirmation' => 'UpdatedLogistics456',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('current_password');

        $this->withToken($first->plainTextToken)
            ->putJson('/api/v1/logistics/account/password', [
                'current_password' => 'CurrentLogistics123',
                'password' => 'UpdatedLogistics456',
                'password_confirmation' => 'UpdatedLogistics456',
            ])
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('message', 'Password updated successfully. All Logistics access tokens have been revoked.')
            ->assertJsonMissingPath('password')
            ->assertJsonMissingPath('token');

        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertTrue(Hash::check('UpdatedLogistics456', $logistics->fresh()->password));
        $this->app['auth']->forgetGuards();
        $this->withToken($second->plainTextToken)->getJson('/api/v1/logistics/account')->assertUnauthorized();
    }

    public function test_password_change_rejects_immutable_fields(): void
    {
        $logistics = $this->logistics('throttle@example.com');

        $this->actingAs($logistics)
            ->putJson('/api/v1/logistics/account/password', [
                'current_password' => 'CurrentLogistics123',
                'password' => 'short',
                'password_confirmation' => 'short',
                'email' => 'tampered@example.com',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['password', 'email']);
    }

    public function test_password_change_is_throttled(): void
    {
        $logistics = $this->logistics('throttle@example.com');

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->actingAs($logistics)
                ->putJson('/api/v1/logistics/account/password', [
                    'current_password' => 'wrong-password',
                    'password' => 'UpdatedLogistics456',
                    'password_confirmation' => 'UpdatedLogistics456',
                ])
                ->assertUnprocessable();
        }

        $this->putJson('/api/v1/logistics/account/password', [
            'current_password' => 'wrong-password',
            'password' => 'UpdatedLogistics456',
            'password_confirmation' => 'UpdatedLogistics456',
        ])->assertTooManyRequests()->assertHeader('Retry-After');
    }

    private function logistics(string $email = 'logistics@example.com', UserStatus $status = UserStatus::Active): User
    {
        $user = User::factory()->create([
            'email' => $email,
            'role' => UserRole::Logistics,
            'status' => $status,
            'password' => 'CurrentLogistics123',
        ]);
        $user->logisticsProfile()->create([
            'first_name' => 'Logan',
            'last_name' => 'Operator',
            'middle_name' => 'A',
            'contact_number' => '09171234567',
            'sex' => UserSex::Male,
            'birth_date' => '1990-01-01',
        ]);
        $address = $user->addresses()->create([
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
        $organization = $user->logisticsOrganization()->create(['business_name' => 'Aisley Delivery Services']);
        $organization->hub()->create(['address_id' => $address->id, 'name' => 'Aisley operational hub']);

        return $user;
    }
}
