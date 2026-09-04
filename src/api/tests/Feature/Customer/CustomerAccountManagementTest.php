<?php

namespace Tests\Feature\Customer;

use App\Enums\UserRole;
use App\Enums\UserSex;
use App\Enums\UserStatus;
use App\Models\CustomerProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerAccountManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_an_active_customer_can_read_the_private_account_resource(): void
    {
        $this->getJson('/api/v1/customer/account')->assertUnauthorized();

        $seller = User::factory()->create([
            'role' => UserRole::Seller,
            'status' => UserStatus::Active,
        ]);
        Sanctum::actingAs($seller);
        $this->getJson('/api/v1/customer/account')
            ->assertForbidden()
            ->assertJsonPath('code', 'FORBIDDEN_ROLE');

        $pending = $this->customer(['status' => UserStatus::Pending]);
        Sanctum::actingAs($pending);
        $this->getJson('/api/v1/customer/account')
            ->assertForbidden()
            ->assertJsonPath('code', 'ACCOUNT_PENDING_APPROVAL');

        $customer = $this->customer(['email' => 'active@example.com']);
        Sanctum::actingAs($customer);
        $this->getJson('/api/v1/customer/account')
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('account.id', $customer->id)
            ->assertJsonPath('account.email', 'active@example.com')
            ->assertJsonPath('account.role', UserRole::Customer->value)
            ->assertJsonPath('account.status', UserStatus::Active->value)
            ->assertJsonPath('account.profile.firstName', 'Aisley')
            ->assertJsonPath('account.profile.age', now()->year - 2000)
            ->assertJsonMissingPath('account.password')
            ->assertJsonMissingPath('account.profile.profile_photo_path');
    }

    public function test_customer_can_update_only_their_own_allow_listed_profile_fields(): void
    {
        $customer = $this->customer();
        $otherCustomer = $this->customer(['email' => 'other@example.com']);
        $sellerWithSameEmail = User::factory()->create([
            'email' => $customer->email,
            'role' => UserRole::Seller,
            'status' => UserStatus::Active,
        ]);

        $this->actingAs($customer)->patchJson('/api/v1/customer/account/profile', [
            'first_name' => '  Avery ',
            'middle_name' => '',
            'last_name' => ' Buyer ',
            'contact_number' => ' +639181234567 ',
            'sex' => UserSex::NonBinary->value,
            'birth_date' => '1998-06-15',
        ])->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('message', 'Profile updated successfully.')
            ->assertJsonPath('account.profile.firstName', 'Avery')
            ->assertJsonPath('account.profile.middleName', null)
            ->assertJsonPath('account.profile.contactNumber', '+639181234567')
            ->assertJsonPath('customer.displayName', 'Avery Buyer');

        $this->assertDatabaseHas('customer_profiles', [
            'user_id' => $customer->id,
            'first_name' => 'Avery',
            'middle_name' => null,
            'contact_number' => '+639181234567',
        ]);
        $this->assertDatabaseHas('customer_profiles', [
            'user_id' => $otherCustomer->id,
            'first_name' => 'Aisley',
        ]);
        $this->assertSame($customer->email, $sellerWithSameEmail->fresh()->email);
    }

    public function test_profile_update_rejects_invalid_and_forbidden_fields_without_partial_changes(): void
    {
        $customer = $this->customer();

        $this->actingAs($customer)->patchJson('/api/v1/customer/account/profile', [
            'first_name' => 'Changed',
            'middle_name' => null,
            'last_name' => 'Buyer',
            'contact_number' => '+639181234567',
            'sex' => 'unknown',
            'birth_date' => now()->addDay()->toDateString(),
            'email' => 'forged@example.com',
            'role' => UserRole::Admin->value,
            'status' => UserStatus::Suspended->value,
            'user_id' => User::factory()->create()->id,
            'profile_photo_path' => 'private/file.png',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors([
                'sex',
                'birth_date',
                'email',
                'role',
                'status',
                'user_id',
                'profile_photo_path',
            ]);

        $this->assertDatabaseHas('customer_profiles', [
            'user_id' => $customer->id,
            'first_name' => 'Aisley',
        ]);
        $this->assertSame('customer@example.com', $customer->fresh()->email);
        $this->assertSame(UserStatus::Active, $customer->fresh()->status);
    }

    public function test_password_change_requires_current_confirmed_strong_password_and_revokes_other_tokens(): void
    {
        $customer = $this->customer(['password' => 'CurrentPassword1']);
        $customer->createToken('Phone');
        $customer->createToken('Tablet');

        $this->actingAs($customer)->patchJson('/api/v1/customer/account/password', [
            'current_password' => 'wrong-password',
            'password' => 'UpdatedPassword2',
            'password_confirmation' => 'UpdatedPassword2',
        ])->assertUnprocessable()->assertJsonValidationErrors('current_password');

        $this->patchJson('/api/v1/customer/account/password', [
            'current_password' => 'CurrentPassword1',
            'password' => 'weak',
            'password_confirmation' => 'different',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');

        $this->patchJson('/api/v1/customer/account/password', [
            'current_password' => 'CurrentPassword1',
            'password' => 'UpdatedPassword2',
            'password_confirmation' => 'UpdatedPassword2',
        ])->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('message', 'Password updated successfully. Other app access tokens have been revoked.')
            ->assertJsonMissingPath('password');

        $this->assertTrue(Hash::check('UpdatedPassword2', $customer->fresh()->password));
        $this->assertDatabaseMissing('personal_access_tokens', ['tokenable_id' => $customer->id]);
        $this->getJson('/api/v1/customer/account')->assertOk();

        $this->patchJson('/api/v1/customer/account/password', [
            'current_password' => 'CurrentPassword1',
            'password' => 'AnotherPassword3',
            'password_confirmation' => 'AnotherPassword3',
        ])->assertUnprocessable()->assertJsonValidationErrors('current_password');
    }

    public function test_token_authenticated_password_change_preserves_the_current_token_only(): void
    {
        $customer = $this->customer(['password' => 'CurrentPassword1']);
        $currentToken = $customer->createToken('Current phone');
        $otherToken = $customer->createToken('Old tablet');

        $this->withToken($currentToken->plainTextToken)->patchJson('/api/v1/customer/account/password', [
            'current_password' => 'CurrentPassword1',
            'password' => 'UpdatedPassword2',
            'password_confirmation' => 'UpdatedPassword2',
        ])->assertOk();

        $this->assertDatabaseHas('personal_access_tokens', ['id' => $currentToken->accessToken->id]);
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $otherToken->accessToken->id]);
        $this->withToken($currentToken->plainTextToken)
            ->getJson('/api/v1/customer/account')
            ->assertOk();
    }

    public function test_password_change_is_rate_limited(): void
    {
        $customer = $this->customer(['password' => 'CurrentPassword1']);
        $this->actingAs($customer);

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->patchJson('/api/v1/customer/account/password', [
                'current_password' => 'wrong-password',
                'password' => 'UpdatedPassword2',
                'password_confirmation' => 'UpdatedPassword2',
            ])->assertUnprocessable();
        }

        $this->patchJson('/api/v1/customer/account/password', [
            'current_password' => 'wrong-password',
            'password' => 'UpdatedPassword2',
            'password_confirmation' => 'UpdatedPassword2',
        ])->assertTooManyRequests();
    }

    /** @param array<string, mixed> $overrides */
    private function customer(array $overrides = []): User
    {
        $customer = User::factory()->create(array_merge([
            'email' => 'customer@example.com',
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ], $overrides));

        CustomerProfile::create([
            'user_id' => $customer->id,
            'first_name' => 'Aisley',
            'middle_name' => 'Q',
            'last_name' => 'Buyer',
            'contact_number' => '+639171234567',
            'sex' => UserSex::PreferNotToSay,
            'birth_date' => '2000-01-01',
            'profile_photo_path' => 'customer-profile-photos/private.png',
        ]);

        return $customer;
    }
}
