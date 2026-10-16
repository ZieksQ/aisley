<?php

namespace Tests\Feature\Mail;

use App\Enums\EmailDeliveryStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\PasswordChangeChallenge;
use App\Models\TransactionalEmail;
use App\Models\User;
use App\Notifications\Account\PasswordChangeCodeNotification;
use App\Services\Account\PasswordChangeVerification;
use App\Services\Mail\TransactionalEmailSender;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class PasswordChangeVerificationTest extends TestCase
{
    use RefreshDatabase;

    public static function roles(): iterable
    {
        foreach ([UserRole::Customer, UserRole::Seller, UserRole::Logistics, UserRole::Courier] as $role) {
            yield $role->value => [$role];
        }
    }

    #[DataProvider('roles')]
    public function test_code_is_encrypted_for_delivery_hashed_for_verification_and_consumed_once(UserRole $role): void
    {
        $user = $this->user($role);
        [$challenge, $code, $email] = $this->request($user);
        $this->assertMatchesRegularExpression('/^[0-9]{6}$/', $code);
        $stored = PasswordChangeChallenge::findOrFail($challenge['challenge_id']);
        $this->assertTrue(Hash::check($code, $stored->code_hash));
        $raw = DB::table('transactional_emails')->where('id', $email->id)->value('payload');
        $this->assertStringNotContainsString('"code"', $raw);
        $this->assertStringNotContainsString($user->email, $raw);
        $this->assertTrue(Hash::check('BeforePassword1', $user->fresh()->password));
        $this->complete($user, $challenge, $code);
        $this->assertTrue(Hash::check('AfterPassword2', $user->fresh()->password));
        $this->assertNotNull($stored->fresh()->consumed_at);
        $this->assertFalse(app(PasswordChangeVerification::class)->isUsable($stored->fresh(), $user->fresh()));
        $this->assertInvalid(fn () => app(PasswordChangeVerification::class)->complete($user->fresh(), 'AfterPassword2', 'AfterPassword2', $stored->id, $code, fn () => $this->fail('Replayed mutation')));
    }

    #[DataProvider('roles')]
    public function test_wrong_codes_persist_attempts_and_lock_out_on_fifth_attempt(UserRole $role): void
    {
        $user = $this->user($role);
        [$challenge, $code] = $this->request($user);
        $wrong = $code === '000000' ? '111111' : '000000';
        for ($attempt = 1; $attempt <= 5; $attempt++) {
            $this->assertInvalid(fn () => $this->complete($user, $challenge, $wrong));
            $this->assertSame($attempt, PasswordChangeChallenge::findOrFail($challenge['challenge_id'])->attempts);
        }
        $this->assertInvalid(fn () => $this->complete($user, $challenge, $code));
        $this->assertTrue(Hash::check('BeforePassword1', $user->fresh()->password));
    }

    #[DataProvider('roles')]
    public function test_resend_cooldown_hourly_limit_and_replacement(UserRole $role): void
    {
        $user = $this->user($role);
        [$first, $code] = $this->request($user);
        try {
            $this->request($user);
            $this->fail('Cooldown was bypassed');
        } catch (HttpException $error) {
            $this->assertSame(429, $error->getStatusCode());
            $this->assertSame('60', $error->getHeaders()['Retry-After']);
        }
        for ($attempt = 1; $attempt < 5; $attempt++) {
            $this->travel(61)->seconds();
            $this->request($user);
        }
        $this->assertInvalid(fn () => $this->complete($user, $first, $code));
        $this->travel(61)->seconds();
        $this->expectException(HttpException::class);
        $this->request($user);
    }

    #[DataProvider('roles')]
    public function test_expiry_identity_and_password_binding_fail_closed(UserRole $role): void
    {
        $user = $this->user($role);
        [$challenge, $code] = $this->request($user);
        $other = $this->user($role, 'other@example.test');
        $this->assertInvalid(fn () => $this->complete($other, $challenge, $code));
        $this->assertInvalid(fn () => app(PasswordChangeVerification::class)->complete($user, 'BeforePassword1', 'DifferentPassword3', $challenge['challenge_id'], $code, fn () => $this->fail('Changed draft accepted')));
        $this->travel(61)->seconds();
        [$challenge, $code] = $this->request($user);
        $user->update(['email' => 'changed@example.test']);
        $this->assertInvalid(fn () => $this->complete($user, $challenge, $code));
        $this->travel(61)->seconds();
        [$challenge, $code] = $this->request($user);
        $this->travel(10)->minutes();
        $this->assertInvalid(fn () => $this->complete($user, $challenge, $code));
        $this->assertTrue(Hash::check('BeforePassword1', $user->fresh()->password));
    }

    #[DataProvider('roles')]
    public function test_delivery_is_obsolete_after_password_change_and_rollback_keeps_code_usable(UserRole $role): void
    {
        $user = $this->user($role);
        [$challenge, $code, $email] = $this->request($user);
        try {
            app(PasswordChangeVerification::class)->complete($user, 'BeforePassword1', 'AfterPassword2', $challenge['challenge_id'], $code, function (User $locked): void {
                $locked->update(['password' => 'AfterPassword2']);
                throw new \RuntimeException('Synthetic rollback');
            });
        } catch (\RuntimeException) {
            $this->assertTrue(Hash::check('BeforePassword1', $user->fresh()->password));
            $this->assertNull(PasswordChangeChallenge::findOrFail($challenge['challenge_id'])->consumed_at);
        }
        $this->complete($user, $challenge, $code);
        Notification::fake();
        app(TransactionalEmailSender::class)->deliver($email->id);
        Notification::assertNothingSent();
        $this->assertSame(EmailDeliveryStatus::Skipped, $email->fresh()->status);
        $this->assertNull($email->fresh()->payload);
    }

    public function test_same_email_other_role_cannot_use_a_challenge_and_mail_failure_preserves_password(): void
    {
        $customer = $this->user(UserRole::Customer);
        [$challenge, $code, $email] = $this->request($customer);
        $seller = $this->user(UserRole::Seller);
        $this->assertInvalid(fn () => $this->complete($seller, $challenge, $code));
        Notification::shouldReceive('sendNow')->once()->andThrow(new \RuntimeException('Synthetic mail failure'));
        app(TransactionalEmailSender::class)->deliver($email->id);
        $this->assertSame(EmailDeliveryStatus::Pending, $email->fresh()->status);
        $this->assertTrue(Hash::check('BeforePassword1', $customer->fresh()->password));
        $this->assertNull(PasswordChangeChallenge::findOrFail($challenge['challenge_id'])->consumed_at);
    }

    public function test_mail_contains_code_and_clears_accepted_payload(): void
    {
        $user = $this->user(UserRole::Courier);
        [$challenge, $code, $email] = $this->request($user);
        Notification::fake();
        app(TransactionalEmailSender::class)->deliver($email->id);
        Notification::assertSentTo($user, PasswordChangeCodeNotification::class, function ($notification) use ($user, $code): bool {
            $mail = $notification->toMail($user);
            $this->assertContains($code, $mail->introLines);

            return true;
        });
        $this->assertSame(EmailDeliveryStatus::Accepted, $email->fresh()->status);
        $this->assertNull($email->fresh()->payload);
    }

    #[DataProvider('roles')]
    public function test_encrypted_database_job_delivers_the_code_through_the_configured_mailer(UserRole $role): void
    {
        $user = $this->user($role);
        [$challenge, $code, $email] = $this->request($user);
        $job = DB::table('jobs')->sole();
        $this->assertStringNotContainsString($user->email, $job->payload);
        $this->assertStringNotContainsString('BeforePassword1', $job->payload);
        $this->assertStringNotContainsString('AfterPassword2', $job->payload);
        $this->assertCount(0, Mail::mailer()->getSymfonyTransport()->messages());
        $this->artisan('queue:work', ['connection' => 'database', '--once' => true, '--sleep' => 0])->assertSuccessful();
        $message = Mail::mailer()->getSymfonyTransport()->messages()->sole()->getOriginalMessage();
        $this->assertSame($user->email, $message->getTo()[0]->getAddress());
        $this->assertStringContainsString($code, $message->getHtmlBody());
        $this->assertStringNotContainsString('BeforePassword1', $message->getHtmlBody());
        $this->assertStringNotContainsString('AfterPassword2', $message->getHtmlBody());
        $this->assertSame(EmailDeliveryStatus::Accepted, $email->fresh()->status);
        $this->assertNull($email->fresh()->payload);
        $this->assertNull(PasswordChangeChallenge::findOrFail($challenge['challenge_id'])->consumed_at);
    }

    public function test_challenge_and_email_intent_roll_back_together(): void
    {
        $user = $this->user(UserRole::Customer);
        try {
            DB::transaction(function () use ($user): void {
                $this->request($user);
                throw new \RuntimeException('Synthetic rollback');
            });
        } catch (\RuntimeException) {
            $this->assertDatabaseCount('password_change_challenges', 0);
            $this->assertDatabaseCount('transactional_emails', 0);
            $this->assertDatabaseCount('jobs', 0);
        }
    }

    private function user(UserRole $role, string $email = 'owner@example.test'): User
    {
        return User::factory()->create(['role' => $role, 'status' => UserStatus::Active, 'email' => $email, 'password' => 'BeforePassword1']);
    }

    private function request(User $user): array
    {
        $challenge = app(PasswordChangeVerification::class)->request($user, 'BeforePassword1', 'AfterPassword2');
        $email = TransactionalEmail::where('deduplication_key', 'password-change:'.$challenge['challenge_id'])->firstOrFail();

        return [$challenge, $email->payload['code'], $email];
    }

    private function complete(User $user, array $challenge, string $code): void
    {
        app(PasswordChangeVerification::class)->complete($user, 'BeforePassword1', 'AfterPassword2', $challenge['challenge_id'], $code, fn (User $locked) => $locked->update(['password' => 'AfterPassword2']));
    }

    private function assertInvalid(callable $action): void
    {
        try {
            $action();
            $this->fail('Invalid verification accepted');
        } catch (ValidationException $error) {
            $this->assertArrayHasKey('verification_code', $error->errors());
        }
    }
}
