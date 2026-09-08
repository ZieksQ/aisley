<?php

namespace Tests\Feature\Courier;

use App\Enums\AddressType;
use App\Enums\CourierAffiliationStatus;
use App\Enums\UserRole;
use App\Enums\UserSex;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CourierAccountManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_an_active_approved_courier_can_read_their_private_account(): void
    {
        $this->getJson('/api/v1/courier/account')->assertUnauthorized();

        $customer = User::factory()->create([
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ]);
        $this->actingAs($customer)
            ->getJson('/api/v1/courier/account')
            ->assertForbidden()
            ->assertJsonPath('code', 'FORBIDDEN_ROLE');

        $courier = $this->courier();
        $this->actingAs($courier)
            ->getJson('/api/v1/courier/account')
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertHeader('Pragma', 'no-cache')
            ->assertJsonPath('account.id', $courier->id)
            ->assertJsonPath('account.email', 'courier@example.com')
            ->assertJsonPath('account.role', 'courier')
            ->assertJsonPath('account.profile.first_name', 'Cora')
            ->assertJsonPath('account.profile.middle_name', null)
            ->assertJsonPath('account.profile.last_name', 'Rider')
            ->assertJsonPath('account.profile.contact_number', '09171234568')
            ->assertJsonPath('account.profile.sex', 'female')
            ->assertJsonPath('account.profile.birth_date', '1994-06-15')
            ->assertJsonPath('account.affiliation.status', 'approved')
            ->assertJsonPath('account.affiliation.organization_name', 'Aisley Delivery Services')
            ->assertJsonPath('account.affiliation.hub_name', 'Aisley operational hub')
            ->assertJsonPath('account.security.email_editable', false)
            ->assertJsonPath('account.security.profile_photo_editable', false)
            ->assertJsonPath('account.security.password_change_requires_current_password', true)
            ->assertJsonPath('account.profile.profile_photo_url', null)
            ->assertJsonMissingPath('account.password')
            ->assertJsonMissingPath('account.profile.profile_photo_path')
            ->assertJsonMissingPath('account.affiliation.reviewer_id');
    }

    public function test_pending_or_invalidly_affiliated_courier_cannot_read_or_update_account(): void
    {
        $pending = $this->courier('pending@example.com', UserStatus::Pending);
        $this->actingAs($pending)
            ->getJson('/api/v1/courier/account')
            ->assertForbidden()
            ->assertJsonPath('code', 'ACCOUNT_PENDING_APPROVAL');

        $invalid = $this->courier('invalid@example.com');
        $invalid->courierLogisticsAffiliation()->update(['status' => CourierAffiliationStatus::Pending]);

        $this->actingAs($invalid)
            ->patchJson('/api/v1/courier/account/profile', ['first_name' => 'Tampered'])
            ->assertForbidden()
            ->assertJsonPath('code', 'LOGISTICS_ASSOCIATION_INVALID');

        $this->assertDatabaseHas('courier_profiles', [
            'user_id' => $invalid->id,
            'first_name' => 'Cora',
        ]);
    }

    public function test_courier_can_update_only_their_allow_listed_profile_fields(): void
    {
        $courier = $this->courier();

        $this->actingAs($courier)
            ->patchJson('/api/v1/courier/account/profile', [
                'first_name' => 'Clara',
                'middle_name' => '  Q  ',
                'contact_number' => ' 09179999999 ',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Profile updated successfully.')
            ->assertJsonPath('account.profile.first_name', 'Clara')
            ->assertJsonPath('account.profile.middle_name', 'Q')
            ->assertJsonPath('account.profile.last_name', 'Rider')
            ->assertJsonPath('account.profile.contact_number', '09179999999');

        $profile = $courier->courierProfile()->firstOrFail();
        $this->assertSame('Clara', $profile->first_name);
        $this->assertSame('Q', $profile->middle_name);
        $this->assertSame('Rider', $profile->last_name);
        $this->assertSame('09179999999', $profile->contact_number);
        $this->assertSame(UserSex::Female, $profile->sex);
        $this->assertSame('1994-06-15', $profile->birth_date?->toDateString());
    }

    public function test_profile_update_rejects_prohibited_and_unknown_fields_without_partial_writes(): void
    {
        $courier = $this->courier();

        $this->actingAs($courier)
            ->patchJson('/api/v1/courier/account/profile', [
                'first_name' => 'Tampered',
                'email' => 'changed@example.com',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        $this->patchJson('/api/v1/courier/account/profile', [
            'last_name' => 'Tampered',
            'arbitrary_attribute' => 'not allowed',
        ])->assertUnprocessable()->assertJsonValidationErrors('arbitrary_attribute');

        $this->assertDatabaseHas('courier_profiles', [
            'user_id' => $courier->id,
            'first_name' => 'Cora',
            'last_name' => 'Rider',
        ]);
        $this->assertDatabaseHas('users', [
            'id' => $courier->id,
            'email' => 'courier@example.com',
        ]);
    }

    public function test_profile_update_normalizes_empty_middle_name_and_validates_invalid_values(): void
    {
        $courier = $this->courier();

        $this->actingAs($courier)
            ->patchJson('/api/v1/courier/account/profile', ['middle_name' => '   '])
            ->assertOk()
            ->assertJsonPath('account.profile.middle_name', null);

        $this->patchJson('/api/v1/courier/account/profile', ['first_name' => '   '])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('first_name');

        $this->patchJson('/api/v1/courier/account/profile', ['contact_number' => str_repeat('1', 33)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('contact_number');
    }

    public function test_password_change_requires_current_password_and_revokes_every_token(): void
    {
        $courier = $this->courier();
        $first = $courier->createToken('phone');
        $second = $courier->createToken('tablet');

        $this->withToken($first->plainTextToken)
            ->putJson('/api/v1/courier/account/password', [
                'current_password' => 'wrong-password',
                'password' => 'UpdatedCourier456',
                'password_confirmation' => 'UpdatedCourier456',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('current_password');

        $this->withToken($first->plainTextToken)
            ->putJson('/api/v1/courier/account/password', [
                'current_password' => 'CurrentCourier123',
                'password' => 'UpdatedCourier456',
                'password_confirmation' => 'UpdatedCourier456',
            ])
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('message', 'Password updated successfully. All Courier access tokens have been revoked.')
            ->assertJsonMissingPath('password')
            ->assertJsonMissingPath('token');

        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertTrue(Hash::check('UpdatedCourier456', $courier->fresh()->password));
        $this->app['auth']->forgetGuards();
        $this->withToken($second->plainTextToken)
            ->getJson('/api/v1/courier/account')
            ->assertUnauthorized();
    }

    public function test_password_change_rejects_prohibited_fields_and_password_policy(): void
    {
        $courier = $this->courier();
        $this->actingAs($courier)
            ->putJson('/api/v1/courier/account/password', [
                'current_password' => 'CurrentCourier123',
                'password' => 'short',
                'password_confirmation' => 'short',
                'email' => 'tampered@example.com',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['password', 'email']);

        $this->assertTrue(Hash::check('CurrentCourier123', $courier->fresh()->password));
    }

    public function test_password_change_is_throttled_per_courier_and_ip(): void
    {
        $courier = $this->courier();

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->actingAs($courier)
                ->putJson('/api/v1/courier/account/password', [
                    'current_password' => 'wrong-password',
                    'password' => 'UpdatedCourier456',
                    'password_confirmation' => 'UpdatedCourier456',
                ])
                ->assertUnprocessable();
        }

        $this->putJson('/api/v1/courier/account/password', [
            'current_password' => 'wrong-password',
            'password' => 'UpdatedCourier456',
            'password_confirmation' => 'UpdatedCourier456',
        ])->assertTooManyRequests()->assertHeader('Retry-After');
    }

    private function courier(string $email = 'courier@example.com', UserStatus $status = UserStatus::Active): User
    {
        $logistics = User::factory()->create([
            'email' => $email === 'courier@example.com' ? 'logistics@example.com' : 'logistics-'.$email,
            'role' => UserRole::Logistics,
            'status' => UserStatus::Active,
        ]);
        $logistics->logisticsProfile()->create([
            'first_name' => 'Logan',
            'last_name' => 'Operator',
            'contact_number' => '09171234567',
            'sex' => UserSex::Male,
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
            'name' => 'Aisley operational hub',
        ]);

        $courier = User::factory()->create([
            'email' => $email,
            'password' => 'CurrentCourier123',
            'role' => UserRole::Courier,
            'status' => $status,
        ]);
        $courier->courierProfile()->create([
            'first_name' => 'Cora',
            'last_name' => 'Rider',
            'contact_number' => '09171234568',
            'sex' => UserSex::Female,
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
