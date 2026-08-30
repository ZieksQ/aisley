<?php

namespace Tests\Feature\Seller;

use App\Enums\ApplicationStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserSex;
use App\Enums\UserStatus;
use App\Models\SellerProfile;
use App\Models\Shop;
use App\Models\User;
use App\Notifications\Seller\ResetPasswordNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\RateLimiter;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SellerAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        RateLimiter::clear('seller-login|seller@example.com|127.0.0.1');

        parent::tearDown();
    }

    public function test_registration_creates_one_pending_seller_profile_and_application_without_a_shop_or_session(): void
    {
        $this->fromSellerApp()->postJson('/api/v1/seller/auth/register', $this->registrationPayload([
            'email' => ' NEW.SELLER@example.com ',
        ]))->assertCreated()
            ->assertJsonPath('message', 'Registration submitted for approval.')
            ->assertJsonPath('seller.email', 'new.seller@example.com')
            ->assertJsonPath('seller.role', UserRole::Seller->value)
            ->assertJsonPath('seller.status', UserStatus::Pending->value)
            ->assertJsonPath('seller.profile.first_name', 'Aisley')
            ->assertJsonPath('seller.shop', null);

        $this->assertGuest();

        $seller = User::query()
            ->where('email', 'new.seller@example.com')
            ->where('role', UserRole::Seller)
            ->firstOrFail();

        $this->assertDatabaseHas('seller_profiles', [
            'user_id' => $seller->id,
            'first_name' => 'Aisley',
            'last_name' => 'Merchant',
        ]);
        $this->assertDatabaseHas('registration_applications', [
            'user_id' => $seller->id,
            'application_type' => UserRole::Seller->value,
            'status' => ApplicationStatus::Pending->value,
        ]);
        $this->assertDatabaseCount('shops', 0);
    }

    public function test_registration_is_unique_within_the_seller_role_and_rejects_authority_fields(): void
    {
        User::factory()->create([
            'email' => 'shared@example.com',
            'role' => UserRole::Customer,
        ]);

        $this->postJson('/api/v1/seller/auth/register', $this->registrationPayload([
            'email' => 'shared@example.com',
        ]))->assertCreated();

        $this->postJson('/api/v1/seller/auth/register', $this->registrationPayload([
            'email' => 'SHARED@example.com',
        ]))->assertUnprocessable()
            ->assertJsonPath('code', 'EMAIL_ALREADY_REGISTERED')
            ->assertJsonValidationErrors('email');

        $this->postJson('/api/v1/seller/auth/register', $this->registrationPayload([
            'email' => 'another@example.com',
            'role' => UserRole::Admin->value,
            'status' => UserStatus::Active->value,
            'reviewer_id' => fake()->uuid(),
        ]))->assertUnprocessable()
            ->assertJsonValidationErrors(['role', 'status', 'reviewer_id']);

        $this->assertDatabaseCount('users', 2);
    }

    public function test_active_seller_can_use_a_web_session_restore_identity_and_logout(): void
    {
        $seller = $this->createSeller([
            'email' => 'seller@example.com',
            'password' => 'Correct123',
        ]);
        $shop = Shop::create([
            'seller_id' => $seller->id,
            'name' => 'Aisley Goods',
            'slug' => 'aisley-goods',
            'status' => ShopStatus::Active,
        ]);

        $this->fromSellerApp()->postJson('/api/v1/seller/auth/login', [
            'email' => ' SELLER@example.com ',
            'password' => 'Correct123',
            'remember' => true,
        ])->assertOk()
            ->assertJsonMissingPath('token')
            ->assertJsonPath('seller.id', $seller->id)
            ->assertJsonPath('seller.profile.first_name', 'Aisley')
            ->assertJsonPath('seller.shop.id', $shop->id);

        $this->assertAuthenticatedAs($seller);

        $this->getJson('/api/v1/seller/auth/me')
            ->assertOk()
            ->assertJsonPath('seller.role', UserRole::Seller->value)
            ->assertJsonPath('seller.status', UserStatus::Active->value);

        $this->postJson('/api/v1/seller/auth/logout')
            ->assertOk()
            ->assertJsonPath('message', 'Signed out successfully.');

        $this->assertGuest();
        $this->getJson('/api/v1/seller/auth/me')->assertUnauthorized();
    }

    public function test_seller_login_never_accepts_mobile_token_or_role_inputs(): void
    {
        $seller = $this->createSeller([
            'email' => 'browser-only@example.com',
            'password' => 'Correct123',
        ]);

        $this->postJson('/api/v1/seller/auth/login', [
            'email' => $seller->email,
            'password' => 'Correct123',
            'device_name' => 'Browser',
            'role' => UserRole::Seller->value,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['device_name', 'role']);

        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertGuest();
    }

    public function test_non_active_sellers_receive_stable_status_codes(): void
    {
        $statuses = [
            UserStatus::Pending->value => 'ACCOUNT_PENDING_APPROVAL',
            UserStatus::Rejected->value => 'ACCOUNT_REJECTED',
            UserStatus::Suspended->value => 'ACCOUNT_SUSPENDED',
            UserStatus::Deactivated->value => 'ACCOUNT_INACTIVE',
        ];

        foreach ($statuses as $status => $code) {
            $seller = $this->createSeller([
                'email' => "{$status}@example.com",
                'password' => 'Correct123',
                'status' => $status,
            ]);

            $this->postJson('/api/v1/seller/auth/login', [
                'email' => $seller->email,
                'password' => 'Correct123',
            ])->assertForbidden()
                ->assertJsonPath('code', $code)
                ->assertJsonMissingPath('seller');

            $this->assertGuest();
        }
    }

    public function test_invalid_and_non_seller_credentials_share_the_same_error(): void
    {
        $customer = User::factory()->create([
            'email' => 'shared@example.com',
            'password' => 'Correct123',
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ]);

        foreach ([
            ['email' => 'missing@example.com', 'password' => 'Correct123'],
            ['email' => $customer->email, 'password' => 'Correct123'],
            ['email' => $customer->email, 'password' => 'Wrong1234'],
        ] as $credentials) {
            $this->postJson('/api/v1/seller/auth/login', $credentials)
                ->assertUnprocessable()
                ->assertJsonPath('code', 'INVALID_CREDENTIALS')
                ->assertJsonValidationErrors('email');
        }
    }

    public function test_seller_routes_enforce_role_and_current_approval_status(): void
    {
        $customer = User::factory()->create([
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ]);
        Sanctum::actingAs($customer);

        $this->getJson('/api/v1/seller/auth/me')
            ->assertForbidden()
            ->assertJsonPath('code', 'FORBIDDEN_ROLE');

        $pendingSeller = $this->createSeller(['status' => UserStatus::Pending]);
        Sanctum::actingAs($pendingSeller);

        $this->getJson('/api/v1/seller/auth/me')
            ->assertForbidden()
            ->assertJsonPath('code', 'ACCOUNT_PENDING_APPROVAL');
    }

    public function test_login_is_rate_limited_by_seller_email_and_ip(): void
    {
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->postJson('/api/v1/seller/auth/login', [
                'email' => 'seller@example.com',
                'password' => 'Wrong1234',
            ])->assertUnprocessable();
        }

        $this->postJson('/api/v1/seller/auth/login', [
            'email' => 'seller@example.com',
            'password' => 'Wrong1234',
        ])->assertTooManyRequests()
            ->assertHeader('Retry-After')
            ->assertJsonPath('code', 'RATE_LIMITED');
    }

    public function test_forgot_password_is_generic_and_only_notifies_active_sellers(): void
    {
        Notification::fake();

        $active = $this->createSeller(['email' => 'active@example.com']);
        $pending = $this->createSeller([
            'email' => 'pending@example.com',
            'status' => UserStatus::Pending,
        ]);

        foreach ([$active->email, $pending->email, 'missing@example.com'] as $email) {
            $this->postJson('/api/v1/seller/auth/forgot-password', [
                'email' => $email,
            ])->assertOk()
                ->assertJsonPath(
                    'message',
                    'If a Seller account exists for that email, we will send password reset instructions.',
                );
        }

        Notification::assertSentTo($active, ResetPasswordNotification::class);
        Notification::assertNotSentTo($pending, ResetPasswordNotification::class);
        $this->assertDatabaseHas('password_reset_tokens', [
            'email' => $active->email,
            'role' => UserRole::Seller->value,
        ]);
    }

    public function test_password_reset_is_seller_scoped_single_use_and_revokes_tokens(): void
    {
        Notification::fake();

        $seller = $this->createSeller([
            'email' => 'shared@example.com',
            'password' => 'OldPassword1',
        ]);
        User::factory()->create([
            'email' => $seller->email,
            'role' => UserRole::Customer,
        ]);
        $seller->createToken('Existing token');

        DB::table('password_reset_tokens')->insert([
            'email' => $seller->email,
            'role' => UserRole::Customer->value,
            'token' => Hash::make('customer-token'),
            'created_at' => now(),
        ]);

        $this->postJson('/api/v1/seller/auth/forgot-password', [
            'email' => $seller->email,
        ])->assertOk();

        $token = null;
        Notification::assertSentTo(
            $seller,
            ResetPasswordNotification::class,
            function (ResetPasswordNotification $notification) use (&$token): bool {
                $token = $notification->token;

                return true;
            },
        );

        $payload = [
            'email' => $seller->email,
            'token' => $token,
            'password' => 'NewPassword2',
            'password_confirmation' => 'NewPassword2',
        ];

        $this->postJson('/api/v1/seller/auth/reset-password', $payload)
            ->assertOk()
            ->assertJsonPath('message', 'Password reset successfully.');

        $this->assertTrue(Hash::check('NewPassword2', $seller->fresh()->password));
        $this->assertDatabaseMissing('password_reset_tokens', [
            'email' => $seller->email,
            'role' => UserRole::Seller->value,
        ]);
        $this->assertDatabaseHas('password_reset_tokens', [
            'email' => $seller->email,
            'role' => UserRole::Customer->value,
        ]);
        $this->assertDatabaseMissing('personal_access_tokens', [
            'tokenable_id' => $seller->id,
        ]);

        $this->postJson('/api/v1/seller/auth/reset-password', $payload)
            ->assertUnprocessable()
            ->assertJsonPath('code', 'INVALID_RESET_TOKEN');
    }

    /** @param array<string, mixed> $overrides */
    private function registrationPayload(array $overrides = []): array
    {
        return array_merge([
            'first_name' => 'Aisley',
            'last_name' => 'Merchant',
            'middle_name' => null,
            'contact_number' => '+639171234567',
            'sex' => UserSex::PreferNotToSay->value,
            'birth_date' => '1995-01-01',
            'email' => 'seller@example.com',
            'password' => 'Password1',
            'password_confirmation' => 'Password1',
        ], $overrides);
    }

    /** @param array<string, mixed> $overrides */
    private function createSeller(array $overrides = []): User
    {
        $seller = User::factory()->create(array_merge([
            'role' => UserRole::Seller,
            'status' => UserStatus::Active,
        ], $overrides));

        SellerProfile::create([
            'user_id' => $seller->id,
            'first_name' => 'Aisley',
            'last_name' => 'Merchant',
            'contact_number' => '+639171234567',
            'sex' => UserSex::PreferNotToSay,
            'birth_date' => '1995-01-01',
        ]);

        return $seller;
    }

    private function fromSellerApp(): self
    {
        return $this->withHeader('Origin', 'http://localhost:5174');
    }
}
