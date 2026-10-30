<?php

namespace Tests\Feature\Mail;

use App\Enums\EmailDeliveryStatus;
use App\Enums\TransactionalEmailKind;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\PlatformFeatureControl;
use App\Models\RegistrationEmailChallenge;
use App\Models\TransactionalEmail;
use App\Models\User;
use App\Services\Auth\RegistrationEmailVerification;
use App\Services\Mail\TransactionalEmailSender;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Testing\TestResponse;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class RegistrationEmailVerificationTest extends TestCase
{
    use RefreshDatabase;

    public static function roles(): array
    {
        return array_map(fn ($role) => [$role], ['customer', 'seller', 'logistics', 'courier']);
    }

    #[DataProvider('roles')]
    public function test_role_routes_require_real_codes_and_never_create_users(string $role): void
    {
        $path = '/api/v1/'.$role.'/auth/registration';
        $response = $this->postJson($path.'/verification-code', ['email' => ' NEW@EXAMPLE.COM '])->assertOk();
        $id = $response->json('challenge_id');
        $intent = TransactionalEmail::query()->where('kind', TransactionalEmailKind::RegistrationCode)->firstOrFail();
        $this->assertNull($intent->user_id);
        $this->assertSame('new@example.com', $intent->payload['email']);
        $code = $intent->payload['code'];
        $this->assertStringNotContainsString($code, DB::table('transactional_emails')->value('payload'));
        $this->assertTrue(Hash::check($code, RegistrationEmailChallenge::findOrFail($id)->code_hash));
        $this->postJson($path.'/verify-email', ['email' => 'other@example.com', 'challenge_id' => $id, 'verification_code' => $code])
            ->assertUnprocessable()->assertJsonValidationErrors('verification_code');
        $verified = $this->postJson($path.'/verify-email', ['email' => 'new@example.com', 'challenge_id' => $id, 'verification_code' => $code])
            ->assertOk()->assertJsonMissingPath('token');
        $this->postJson($path.'/verify-email', ['email' => 'new@example.com', 'challenge_id' => $id, 'verification_code' => $code])
            ->assertOk()->assertJsonPath('email_verification_token', $verified->json('email_verification_token'));
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('registration_applications', 0);
        $this->assertDatabaseCount('documents', 0);
        $this->assertGuest();
    }

    public function test_wrong_attempts_are_durable_and_leading_zero_codes_work(): void
    {
        [$id] = $this->challenge();
        RegistrationEmailChallenge::findOrFail($id)->update(['code_hash' => Hash::make('012345')]);
        for ($i = 1; $i <= 5; $i++) {
            $this->verify($id, '999999')->assertUnprocessable();
            $this->assertSame($i, RegistrationEmailChallenge::findOrFail($id)->attempts);
        }
        $this->verify($id, '012345')->assertUnprocessable();
        $this->travel(61)->seconds();
        [$id] = $this->challenge();
        RegistrationEmailChallenge::findOrFail($id)->update(['code_hash' => Hash::make('012345')]);
        $this->verify($id, '012345')->assertOk();
    }

    public function test_resend_limits_expiry_and_role_binding(): void
    {
        [$id, $code] = $this->challenge();
        $this->postJson('/api/v1/customer/auth/registration/verification-code', ['email' => 'new@example.com'])
            ->assertStatus(429)->assertHeader('Retry-After', '60');
        $this->postJson('/api/v1/seller/auth/registration/verify-email', [
            'email' => 'new@example.com', 'challenge_id' => $id, 'verification_code' => $code,
        ])->assertUnprocessable();
        $this->travel(61)->seconds();
        [$replacement] = $this->challenge();
        $this->verify($id, $code)->assertUnprocessable();
        $this->travel(10)->minutes();
        $this->verify($replacement, '000000')->assertUnprocessable();
        for ($i = 0; $i < 3; $i++) {
            $this->challenge();
            $this->travel(61)->seconds();
        }
        $this->postJson('/api/v1/customer/auth/registration/verification-code', ['email' => 'new@example.com'])
            ->assertStatus(429)->assertHeader('Retry-After');
    }

    public function test_registration_consumes_proof_atomically_and_sets_verified_timestamp(): void
    {
        [$id, $code] = $this->challenge();
        $token = $this->verify($id, $code)->assertOk()->json('email_verification_token');
        $service = app(RegistrationEmailVerification::class);
        try {
            $service->complete(UserRole::Customer, 'new@example.com', $token, function () {
                User::factory()->create(['email' => 'new@example.com', 'role' => UserRole::Customer]);
                throw new \RuntimeException('synthetic rollback');
            });
            $this->fail('Expected rollback');
        } catch (\RuntimeException $exception) {
            $this->assertSame('synthetic rollback', $exception->getMessage());
        }
        $this->assertDatabaseCount('users', 0);
        $this->assertNull(RegistrationEmailChallenge::findOrFail($id)->consumed_at);
        $user = $service->complete(UserRole::Customer, 'new@example.com', $token,
            fn () => User::factory()->create(['email' => 'new@example.com', 'role' => UserRole::Customer, 'status' => UserStatus::Pending]));
        $this->assertNotNull($user->email_verified_at);
        $this->assertSame(UserStatus::Pending, $user->status);
        $this->assertNull(RegistrationEmailChallenge::findOrFail($id)->token);
        $this->expectException(ValidationException::class);
        $service->complete(UserRole::Customer, 'new@example.com', $token, fn () => $user);
    }

    public function test_registration_fails_closed_on_unverified_requests_for_every_role(): void
    {
        foreach (self::roles() as [$role]) {
            $this->postJson('/api/v1/'.$role.'/auth/register', ['email' => 'new@example.com'])
                ->assertUnprocessable()->assertJsonValidationErrors('email_verification_token');
        }
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('documents', 0);
    }

    public function test_expired_or_wrong_identity_proof_never_calls_registration(): void
    {
        [$id, $code] = $this->challenge();
        $token = $this->verify($id, $code)->json('email_verification_token');
        foreach ([[UserRole::Seller, 'new@example.com'], [UserRole::Customer, 'other@example.com']] as [$role, $email]) {
            try {
                app(RegistrationEmailVerification::class)->complete($role, $email, $token, fn () => $this->fail('Invalid proof accepted'));
                $this->fail('Expected validation');
            } catch (ValidationException $error) {
                $this->assertArrayHasKey('email_verification_token', $error->errors());
            }
        }
        $this->travel(1)->hours();
        $this->expectException(ValidationException::class);
        app(RegistrationEmailVerification::class)->complete(UserRole::Customer, 'new@example.com', $token, fn () => $this->fail('Expired proof accepted'));
    }

    public function test_real_mail_transport_accepts_guest_code_and_skips_obsolete_code(): void
    {
        [$id] = $this->challenge();
        $email = TransactionalEmail::query()->where('kind', TransactionalEmailKind::RegistrationCode)->firstOrFail();
        app(TransactionalEmailSender::class)->deliver($email->id);
        $this->assertSame(EmailDeliveryStatus::Accepted, $email->fresh()->status);
        $this->assertNull($email->fresh()->payload);
        $this->assertCount(1, Mail::mailer('array')->getSymfonyTransport()->messages());
        $this->travel(61)->seconds();
        [$id] = $this->challenge();
        $email = TransactionalEmail::query()->where('deduplication_key', 'registration-code:'.$id)->firstOrFail();
        $this->travel(10)->minutes();
        app(TransactionalEmailSender::class)->deliver($email->id);
        $this->assertSame(EmailDeliveryStatus::Skipped, $email->fresh()->status);
        $this->assertNull($email->fresh()->payload);
    }

    public function test_cleanup_removes_expired_secrets_without_resetting_hourly_quota(): void
    {
        [$id] = $this->challenge();
        $this->travel(10)->minutes();
        $this->artisan('auth:cleanup-registration-codes')->assertSuccessful();
        $this->assertNull(RegistrationEmailChallenge::findOrFail($id)->code_hash);
        $this->assertDatabaseCount('registration_email_challenges', 1);
    }

    #[DataProvider('roles')]
    public function test_configuration_and_validation_follow_the_switch(string $role): void
    {
        $path = '/api/v1/'.$role.'/auth/registration/config';
        $this->getJson($path)->assertOk()->assertJsonPath('email_verification_required', true)->assertHeader('Cache-Control', 'no-store, private');
        PlatformFeatureControl::where('key', 'registration_email_verification_required')->update(['enabled' => false]);
        $this->getJson($path)->assertOk()->assertJsonPath('email_verification_required', false);
        $this->postJson('/api/v1/'.$role.'/auth/register', [])->assertUnprocessable()->assertJsonMissingValidationErrors('email_verification_token');
        PlatformFeatureControl::where('key', 'registration_email_verification_required')->delete();
        $this->getJson($path)->assertOk()->assertJsonPath('email_verification_required', true);
        $this->postJson('/api/v1/'.$role.'/auth/register', [])->assertUnprocessable()->assertJsonValidationErrors('email_verification_token');
    }

    public function test_registration_bypass_does_not_bypass_authenticated_email_verification(): void
    {
        PlatformFeatureControl::where('key', 'registration_email_verification_required')->update(['enabled' => false]);
        $this->expectException(ValidationException::class);
        app(RegistrationEmailVerification::class)->complete(UserRole::Courier, 'new@example.com', '', fn () => $this->fail('Bypassed email change'));
    }

    private function challenge(): array
    {
        $id = $this->postJson('/api/v1/customer/auth/registration/verification-code', ['email' => 'new@example.com'])
            ->assertOk()->json('challenge_id');
        $intent = TransactionalEmail::query()->where('deduplication_key', 'registration-code:'.$id)->firstOrFail();

        return [$id, $intent->payload['code']];
    }

    private function verify(string $id, string $code): TestResponse
    {
        return $this->postJson('/api/v1/customer/auth/registration/verify-email', [
            'email' => 'new@example.com', 'challenge_id' => $id, 'verification_code' => $code,
        ]);
    }
}
