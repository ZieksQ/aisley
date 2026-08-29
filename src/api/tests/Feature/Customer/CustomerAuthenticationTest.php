<?php

namespace Tests\Feature\Customer;

use App\Enums\ApplicationStatus;
use App\Enums\UserRole;
use App\Enums\UserSex;
use App\Enums\UserStatus;
use App\Models\CustomerProfile;
use App\Models\User;
use App\Notifications\Customer\ResetPasswordNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_registration_creates_a_pending_account_profile_and_application_without_authenticating(): void
    {
        $this->fromStorefront()->postJson('/api/v1/customer/auth/register', $this->registrationPayload([
            'email' => ' NEW.CUSTOMER@example.com ',
        ]))->assertCreated()
            ->assertJsonPath('message', 'Registration submitted for approval.')
            ->assertJsonPath('customer.email', 'new.customer@example.com')
            ->assertJsonPath('customer.role', UserRole::Customer->value)
            ->assertJsonPath('customer.status', UserStatus::Pending->value)
            ->assertJsonPath('customer.profile.first_name', 'Aisley');

        $this->assertGuest();

        $customer = User::query()
            ->where('email', 'new.customer@example.com')
            ->where('role', UserRole::Customer)
            ->firstOrFail();

        $this->assertSame(UserStatus::Pending, $customer->status);
        $this->assertDatabaseHas('customer_profiles', [
            'user_id' => $customer->id,
            'first_name' => 'Aisley',
            'last_name' => 'Buyer',
        ]);
        $this->assertDatabaseHas('registration_applications', [
            'user_id' => $customer->id,
            'application_type' => UserRole::Customer->value,
            'status' => ApplicationStatus::Pending->value,
        ]);
    }

    public function test_registration_rejects_a_duplicate_customer_email_but_allows_the_same_email_for_another_role(): void
    {
        User::factory()->create([
            'email' => 'shared@example.com',
            'role' => UserRole::Seller,
        ]);

        $this->postJson('/api/v1/customer/auth/register', $this->registrationPayload([
            'email' => 'shared@example.com',
        ]))->assertCreated();

        $this->postJson('/api/v1/customer/auth/register', $this->registrationPayload([
            'email' => 'SHARED@example.com',
        ]))->assertUnprocessable()
            ->assertJsonPath('code', 'EMAIL_ALREADY_REGISTERED')
            ->assertJsonValidationErrors('email');

        $this->assertDatabaseCount('users', 2);
    }

    public function test_registration_does_not_allow_the_client_to_choose_role_or_status(): void
    {
        $this->postJson('/api/v1/customer/auth/register', $this->registrationPayload([
            'role' => UserRole::Admin->value,
            'status' => UserStatus::Active->value,
        ]))->assertUnprocessable()
            ->assertJsonValidationErrors(['role', 'status']);

        $this->assertDatabaseCount('users', 0);
    }

    public function test_active_customer_can_sign_in_with_a_web_session_view_identity_and_sign_out(): void
    {
        $customer = $this->createCustomer([
            'email' => 'customer@example.com',
            'password' => 'Correct123',
        ]);

        $this->fromStorefront()->postJson('/api/v1/customer/auth/login', [
            'email' => ' CUSTOMER@example.com ',
            'password' => 'Correct123',
        ])->assertOk()
            ->assertJsonMissingPath('token')
            ->assertJsonPath('customer.id', $customer->id)
            ->assertJsonPath('customer.displayName', 'Aisley Buyer')
            ->assertJsonMissingPath('customer.email')
            ->assertJsonMissingPath('customer.profile');

        $this->assertAuthenticatedAs($customer);

        $this->getJson('/api/v1/customer/auth/me')
            ->assertOk()
            ->assertJsonPath('customer.displayName', 'Aisley Buyer')
            ->assertJsonPath('customer.role', UserRole::Customer->value)
            ->assertJsonPath('customer.status', UserStatus::Active->value)
            ->assertJsonMissingPath('customer.email')
            ->assertJsonMissingPath('customer.profile');

        $this->postJson('/api/v1/customer/auth/logout')
            ->assertOk()
            ->assertJsonPath('message', 'Signed out successfully.');

        $this->assertGuest();
        $this->getJson('/api/v1/customer/auth/me')->assertUnauthorized();
    }

    public function test_active_customer_can_sign_in_and_sign_out_with_a_mobile_device_token(): void
    {
        $customer = $this->createCustomer([
            'email' => 'mobile@example.com',
            'password' => 'Correct123',
        ]);

        $response = $this->postJson('/api/v1/customer/auth/login', [
            'email' => $customer->email,
            'password' => 'Correct123',
            'device_name' => 'Pixel 10',
        ])->assertOk()
            ->assertJsonStructure(['token'])
            ->assertJsonPath('customer.id', $customer->id);

        $this->assertGuest('web');
        $this->assertDatabaseHas('personal_access_tokens', [
            'tokenable_id' => $customer->id,
            'name' => 'Pixel 10',
        ]);

        $token = (string) $response->json('token');

        $this->withToken($token)
            ->getJson('/api/v1/customer/auth/me')
            ->assertOk()
            ->assertJsonPath('customer.id', $customer->id);

        $this->withToken($token)
            ->postJson('/api/v1/customer/auth/logout')
            ->assertOk();

        $this->assertDatabaseMissing('personal_access_tokens', [
            'tokenable_id' => $customer->id,
        ]);
    }

    public function test_pending_rejected_and_suspended_customers_receive_stable_codes_without_credentials(): void
    {
        $statuses = [
            UserStatus::Pending->value => 'ACCOUNT_PENDING_APPROVAL',
            UserStatus::Rejected->value => 'ACCOUNT_REJECTED',
            UserStatus::Suspended->value => 'ACCOUNT_SUSPENDED',
        ];

        foreach ($statuses as $status => $code) {
            $customer = $this->createCustomer([
                'email' => "{$status}@example.com",
                'password' => 'Correct123',
                'status' => $status,
            ]);

            $this->postJson('/api/v1/customer/auth/login', [
                'email' => $customer->email,
                'password' => 'Correct123',
                'device_name' => 'Test device',
            ])->assertForbidden()
                ->assertJsonPath('code', $code)
                ->assertJsonMissingPath('token');

            $this->assertDatabaseMissing('personal_access_tokens', [
                'tokenable_id' => $customer->id,
            ]);
            $this->assertGuest('web');
        }
    }

    public function test_invalid_or_non_customer_credentials_return_the_same_generic_error(): void
    {
        $seller = User::factory()->create([
            'email' => 'shared@example.com',
            'password' => 'Correct123',
            'role' => UserRole::Seller,
            'status' => UserStatus::Active,
        ]);

        foreach ([
            ['email' => 'missing@example.com', 'password' => 'Correct123'],
            ['email' => $seller->email, 'password' => 'Correct123'],
            ['email' => $seller->email, 'password' => 'Wrong1234'],
        ] as $credentials) {
            $this->postJson('/api/v1/customer/auth/login', $credentials)
                ->assertUnprocessable()
                ->assertJsonPath('code', 'INVALID_CREDENTIALS')
                ->assertJsonValidationErrors('email');
        }

        $this->assertGuest();
    }

    public function test_customer_routes_enforce_role_and_current_approval_status(): void
    {
        $seller = User::factory()->create([
            'role' => UserRole::Seller,
            'status' => UserStatus::Active,
        ]);

        Sanctum::actingAs($seller);

        $this->getJson('/api/v1/customer/auth/me')
            ->assertForbidden()
            ->assertJsonPath('code', 'FORBIDDEN_ROLE');

        $pendingCustomer = $this->createCustomer(['status' => UserStatus::Pending]);
        Sanctum::actingAs($pendingCustomer);

        $this->getJson('/api/v1/customer/auth/me')
            ->assertForbidden()
            ->assertJsonPath('code', 'ACCOUNT_PENDING_APPROVAL');
    }

    public function test_forgot_password_is_generic_and_only_notifies_active_customers(): void
    {
        Notification::fake();

        $activeCustomer = $this->createCustomer(['email' => 'active@example.com']);
        $pendingCustomer = $this->createCustomer([
            'email' => 'pending@example.com',
            'status' => UserStatus::Pending,
        ]);

        foreach ([$activeCustomer->email, $pendingCustomer->email, 'missing@example.com'] as $email) {
            $this->postJson('/api/v1/customer/auth/forgot-password', [
                'email' => $email,
            ])->assertOk()
                ->assertJsonPath(
                    'message',
                    'If a Customer account exists for that email, we will send password reset instructions.',
                );
        }

        Notification::assertSentTo($activeCustomer, ResetPasswordNotification::class);
        Notification::assertNotSentTo($pendingCustomer, ResetPasswordNotification::class);
        $this->assertDatabaseHas('password_reset_tokens', [
            'email' => $activeCustomer->email,
            'role' => UserRole::Customer->value,
        ]);
        $this->assertDatabaseMissing('password_reset_tokens', [
            'email' => $pendingCustomer->email,
            'role' => UserRole::Customer->value,
        ]);
    }

    public function test_customer_password_reset_is_role_scoped_single_use_and_revokes_mobile_tokens(): void
    {
        Notification::fake();

        $customer = $this->createCustomer([
            'email' => 'shared@example.com',
            'password' => 'OldPassword1',
        ]);
        User::factory()->create([
            'email' => $customer->email,
            'role' => UserRole::Seller,
        ]);
        $customer->createToken('Existing phone');

        DB::table('password_reset_tokens')->insert([
            'email' => $customer->email,
            'role' => UserRole::Seller->value,
            'token' => Hash::make('seller-token'),
            'created_at' => now(),
        ]);

        $this->postJson('/api/v1/customer/auth/forgot-password', [
            'email' => $customer->email,
        ])->assertOk();

        $token = null;
        Notification::assertSentTo(
            $customer,
            ResetPasswordNotification::class,
            function (ResetPasswordNotification $notification) use (&$token): bool {
                $token = $notification->token;

                return true;
            },
        );

        $this->postJson('/api/v1/customer/auth/reset-password', [
            'email' => $customer->email,
            'token' => $token,
            'password' => 'NewPassword2',
            'password_confirmation' => 'NewPassword2',
        ])->assertOk()
            ->assertJsonPath('message', 'Password reset successfully.');

        $customer->refresh();
        $this->assertTrue(Hash::check('NewPassword2', $customer->password));
        $this->assertSame(UserStatus::Active, $customer->status);
        $this->assertDatabaseMissing('password_reset_tokens', [
            'email' => $customer->email,
            'role' => UserRole::Customer->value,
        ]);
        $this->assertDatabaseHas('password_reset_tokens', [
            'email' => $customer->email,
            'role' => UserRole::Seller->value,
        ]);
        $this->assertDatabaseMissing('personal_access_tokens', [
            'tokenable_id' => $customer->id,
        ]);

        $this->postJson('/api/v1/customer/auth/reset-password', [
            'email' => $customer->email,
            'token' => $token,
            'password' => 'AnotherPassword3',
            'password_confirmation' => 'AnotherPassword3',
        ])->assertUnprocessable()
            ->assertJsonPath('code', 'INVALID_RESET_TOKEN');
    }

    public function test_expired_or_incorrect_password_reset_token_is_rejected(): void
    {
        $customer = $this->createCustomer(['email' => 'reset@example.com']);

        DB::table('password_reset_tokens')->insert([
            'email' => $customer->email,
            'role' => UserRole::Customer->value,
            'token' => Hash::make('valid-token'),
            'created_at' => now()->subMinutes(61),
        ]);

        foreach (['valid-token', 'wrong-token'] as $token) {
            $this->postJson('/api/v1/customer/auth/reset-password', [
                'email' => $customer->email,
                'token' => $token,
                'password' => 'NewPassword2',
                'password_confirmation' => 'NewPassword2',
            ])->assertUnprocessable()
                ->assertJsonPath('code', 'INVALID_RESET_TOKEN');
        }

        $this->assertTrue(Hash::check('password', $customer->fresh()->password));
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function registrationPayload(array $overrides = []): array
    {
        return array_merge([
            'first_name' => 'Aisley',
            'last_name' => 'Buyer',
            'middle_name' => null,
            'contact_number' => '+639171234567',
            'sex' => UserSex::PreferNotToSay->value,
            'birth_date' => '2000-01-01',
            'email' => 'customer@example.com',
            'password' => 'Password1',
            'password_confirmation' => 'Password1',
        ], $overrides);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createCustomer(array $overrides = []): User
    {
        $customer = User::factory()->create(array_merge([
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ], $overrides));

        CustomerProfile::create([
            'user_id' => $customer->id,
            'first_name' => 'Aisley',
            'last_name' => 'Buyer',
            'contact_number' => '+639171234567',
            'sex' => UserSex::PreferNotToSay,
            'birth_date' => '2000-01-01',
        ]);

        return $customer;
    }

    private function fromStorefront(): self
    {
        return $this->withHeader('Origin', 'http://localhost:3000');
    }
}
