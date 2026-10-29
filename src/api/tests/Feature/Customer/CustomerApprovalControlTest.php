<?php

namespace Tests\Feature\Customer;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\PlatformFeatureControl;
use App\Models\User;
use App\Services\Notifications\AdminNotificationService;
use Database\Seeders\PlatformFeatureControlSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\VerifiedRegistrationEmail;
use Tests\TestCase;

class CustomerApprovalControlTest extends TestCase
{
    use RefreshDatabase, VerifiedRegistrationEmail;

    public function test_disabled_approval_creates_active_verified_buyer_without_credentials_or_review_alert(): void
    {
        $this->control(false);
        $this->mock(AdminNotificationService::class)->shouldNotReceive('registrationSubmitted');
        $this->postJson('/api/v1/customer/auth/register', $this->payload())->assertCreated()
            ->assertJsonPath('customer.status', 'active')->assertJsonMissingPath('token');
        $this->assertGuest();
        $user = User::where('email', 'buyer@example.com')->firstOrFail();
        $this->assertNotNull($user->email_verified_at);
        $application = $user->registrationApplications()->sole();
        $this->assertSame('approved', $application->status->value);
        $this->assertNotNull($application->reviewed_at);
        $this->assertNull($application->reviewer_id);
        $this->postJson('/api/v1/customer/auth/login', [
            'email' => $user->email, 'password' => 'Password1', 'device_name' => 'Test phone',
        ])->assertOk()->assertJsonPath('customer.status', 'active')->assertJsonStructure(['token']);
    }

    public function test_missing_control_defaults_to_pending_and_notifies_admin(): void
    {
        PlatformFeatureControl::where('key', PlatformFeatureControl::CUSTOMER_REGISTRATION_APPROVAL_REQUIRED)->delete();
        $this->mock(AdminNotificationService::class)->shouldReceive('registrationSubmitted')->once();
        $this->postJson('/api/v1/customer/auth/register', $this->payload())->assertCreated()
            ->assertJsonPath('customer.status', 'pending');
        $this->assertDatabaseHas('registration_applications', ['status' => 'pending']);
    }

    public function test_toggle_only_changes_subsequent_registrations_and_seeding_preserves_choice(): void
    {
        $this->postJson('/api/v1/customer/auth/register', $this->payload('pending@example.com'))->assertCreated()
            ->assertJsonPath('customer.status', 'pending');
        $this->control(false);
        $this->seed(PlatformFeatureControlSeeder::class);
        $this->postJson('/api/v1/customer/auth/register', $this->payload('active@example.com'))->assertCreated()
            ->assertJsonPath('customer.status', 'active');
        $this->control(true);
        $this->postJson('/api/v1/customer/auth/register', $this->payload('later@example.com'))->assertCreated()
            ->assertJsonPath('customer.status', 'pending');
        $this->assertDatabaseHas('users', ['email' => 'pending@example.com', 'status' => UserStatus::Pending->value]);
        $this->assertDatabaseHas('users', ['email' => 'active@example.com', 'status' => UserStatus::Active->value]);
        $this->postJson('/api/v1/customer/auth/login', [
            'email' => 'pending@example.com', 'password' => 'Password1', 'device_name' => 'Test phone',
        ])->assertForbidden()->assertJsonPath('code', 'ACCOUNT_PENDING_APPROVAL');
    }

    public function test_disabled_approval_still_requires_verified_email(): void
    {
        $this->control(false);
        $payload = $this->payload();
        $payload['email_verification_token'] = str_repeat('a', 64);
        $this->postJson('/api/v1/customer/auth/register', $payload)->assertUnprocessable()
            ->assertJsonValidationErrors('email_verification_token');
        $this->assertDatabaseCount('users', 0);
    }

    private function control(bool $enabled): void
    {
        PlatformFeatureControl::updateOrCreate(
            ['key' => PlatformFeatureControl::CUSTOMER_REGISTRATION_APPROVAL_REQUIRED],
            ['label' => 'Require buyer account approval', 'enabled' => $enabled],
        );
    }

    private function payload(string $email = 'buyer@example.com'): array
    {
        return [
            'first_name' => 'Test', 'last_name' => 'Buyer', 'email' => $email,
            'contact_number' => '+639171234567', 'sex' => 'prefer_not_to_say', 'birth_date' => '2000-01-01',
            'password' => 'Password1', 'password_confirmation' => 'Password1',
            'email_verification_token' => $this->registrationEmailToken(UserRole::Customer, $email),
        ];
    }
}
