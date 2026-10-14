<?php

namespace Tests\Feature\Mail;

use App\Enums\ApplicationStatus;
use App\Enums\EmailDeliveryStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\TransactionalEmail;
use App\Models\User;
use App\Services\Mail\PasswordResetDeliveryService;
use App\Services\Mail\TransactionalEmailDispatcher;
use App\Services\Mail\TransactionalEmailOutbox;
use App\Services\Mail\TransactionalEmailSender;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class TransactionalEmailDeliveryTest extends TestCase
{
    use RefreshDatabase;

    public static function resetRoles(): iterable
    {
        foreach ([UserRole::Customer, UserRole::Seller, UserRole::Logistics] as $role) {
            yield $role->value => [$role];
        }
    }

    public static function registrationDecisions(): iterable
    {
        foreach ([UserRole::Customer, UserRole::Seller, UserRole::Logistics, UserRole::Courier] as $role) {
            foreach ([ApplicationStatus::Approved, ApplicationStatus::Rejected] as $decision) {
                yield $role->value.'-'.$decision->value => [$role, $decision];
            }
        }
    }

    #[DataProvider('resetRoles')]
    public function test_resets_are_encrypted_async_role_scoped_and_render_the_configured_link(UserRole $role): void
    {
        $user = $this->user($role);
        $otherRole = $role === UserRole::Customer ? UserRole::Seller : UserRole::Customer;
        $other = $this->user($otherRole, $user->email);
        config()->set($role->value.'.auth.password_reset_url', 'https://'.$role->value.'.example.test/reset-password');
        $this->postJson('/api/v1/'.$role->value.'/auth/forgot-password', ['email' => $user->email])->assertOk();

        $event = TransactionalEmail::query()->sole();
        $token = $event->payload['token'];
        $this->assertSame($user->id, $event->user_id);
        $this->assertSame($role, $event->role);
        $this->assertSame(EmailDeliveryStatus::Queued, $event->status);
        $raw = DB::table('transactional_emails')->value('payload');
        $this->assertStringNotContainsString($token, $raw);
        $this->assertStringNotContainsString($user->email, $raw);
        $job = DB::table('jobs')->sole();
        $this->assertStringNotContainsString($token, $job->payload);
        $this->assertStringNotContainsString($user->email, $job->payload);
        $this->assertArrayNotHasKey('payload', $event->toArray());
        $this->assertTrue(Hash::check($token, DB::table('password_reset_tokens')->value('token')));
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $other->email, 'role' => $otherRole->value]);
        $this->assertCount(0, Mail::mailer()->getSymfonyTransport()->messages());

        $this->artisan('queue:work', ['connection' => 'database', '--once' => true, '--sleep' => 0])->assertSuccessful();
        $message = Mail::mailer()->getSymfonyTransport()->messages()->sole()->getOriginalMessage();
        $this->assertSame($user->email, $message->getTo()[0]->getAddress());
        $this->assertSame(config('mail.from.address'), $message->getFrom()[0]->getAddress());
        $this->assertSame(config('mail.from.name'), $message->getFrom()[0]->getName());
        $this->assertStringContainsString(ucfirst($role->value), $message->getSubject());
        $html = html_entity_decode($message->getHtmlBody());
        $this->assertStringContainsString(config($role->value.'.auth.password_reset_url').'?token='.$token, $html);
        $this->assertStringContainsString('email='.urlencode($user->email), $html);
        $this->assertSame(EmailDeliveryStatus::Accepted, $event->fresh()->status);
        $this->assertNotNull($event->fresh()->accepted_at);
        $this->assertNull($event->fresh()->payload);
    }

    #[DataProvider('resetRoles')]
    public function test_generic_recovery_survives_queue_outages_and_excludes_inactive_and_other_roles(UserRole $role): void
    {
        $active = $this->user($role);
        $inactive = $this->user($role);
        $inactive->update(['status' => UserStatus::Pending]);
        $wrongRole = $this->user($role === UserRole::Customer ? UserRole::Seller : UserRole::Customer);
        Bus::shouldReceive('dispatch')->once()->andThrow(new \RuntimeException('Synthetic queue credentials must not escape'));

        $expected = null;
        foreach ([$active->email, $inactive->email, $wrongRole->email, 'unknown@example.test'] as $email) {
            $response = $this->postJson('/api/v1/'.$role->value.'/auth/forgot-password', ['email' => $email])->assertOk();
            $expected ??= $response->json();
            $this->assertSame($expected, $response->json());
        }
        $event = TransactionalEmail::query()->sole();
        $this->assertSame($active->id, $event->user_id);
        $this->assertSame(EmailDeliveryStatus::Pending, $event->status);
        $this->assertSame('queue_unavailable', $event->last_error_code);
        $this->assertSame(1, DB::table('password_reset_tokens')->count());
    }

    #[DataProvider('resetRoles')]
    public function test_superseded_expired_and_consumed_tokens_are_skipped(UserRole $role): void
    {
        Notification::fake();
        $user = $this->user($role);
        $service = app(PasswordResetDeliveryService::class);
        $service->request($user->email, $role);
        $old = TransactionalEmail::query()->sole();
        $service->request($user->email, $role);
        app(TransactionalEmailSender::class)->deliver($old->id);
        $this->assertSame(EmailDeliveryStatus::Skipped, $old->fresh()->status);
        $this->assertNull($old->fresh()->payload);

        $latest = TransactionalEmail::query()->whereKeyNot($old->id)->sole();
        $this->travel(61)->minutes();
        app(TransactionalEmailSender::class)->deliver($latest->id);
        $this->assertSame(EmailDeliveryStatus::Skipped, $latest->fresh()->status);

        $service->request($user->email, $role);
        $consumed = TransactionalEmail::query()->whereNotIn('id', [$old->id, $latest->id])->sole();
        DB::table('password_reset_tokens')->delete();
        app(TransactionalEmailSender::class)->deliver($consumed->id);
        $this->assertSame(EmailDeliveryStatus::Skipped, $consumed->fresh()->status);
        Notification::assertNothingSent();
    }

    #[DataProvider('registrationDecisions')]
    public function test_decision_content_is_role_correct_private_and_sent_once(UserRole $role, ApplicationStatus $decision): void
    {
        $user = $this->user($role);
        $application = $user->registrationApplications()->create([
            'application_type' => $role, 'status' => $decision, 'submitted_at' => now(),
            'reviewed_at' => now(), 'rejection_reason' => 'Please provide readable evidence.',
        ]);
        $event = app(TransactionalEmailOutbox::class)->registrationDecision($application);
        $duplicate = app(TransactionalEmailOutbox::class)->registrationDecision($application);
        $this->assertSame($event->id, $duplicate->id);
        $this->assertDatabaseCount('transactional_emails', 1);
        $this->assertDatabaseCount('jobs', 1);

        $sender = app(TransactionalEmailSender::class);
        $sender->deliver($event->id);
        $sender->deliver($event->id);
        $message = Mail::mailer()->getSymfonyTransport()->messages()->sole()->getOriginalMessage();
        $this->assertSame($user->email, $message->getTo()[0]->getAddress());
        $this->assertStringContainsString(ucfirst($role->value), $message->getSubject());
        $body = $message->getHtmlBody();
        $this->assertStringNotContainsString($application->id, $body);
        $this->assertStringNotContainsString('reviewer_id', $body);
        if ($decision === ApplicationStatus::Rejected) {
            $this->assertStringContainsString('Please provide readable evidence.', $body);
        } else {
            $this->assertStringNotContainsString('Please provide readable evidence.', $body);
        }
        if ($role === UserRole::Courier && $decision === ApplicationStatus::Approved) {
            $this->assertStringContainsString('Courier mobile app', $body);
        }
        $this->assertSame(1, $event->fresh()->attempts);
        $this->assertSame(EmailDeliveryStatus::Accepted, $event->fresh()->status);
    }

    public function test_transport_failures_back_off_exhaust_and_allow_operator_retry(): void
    {
        Log::spy();
        $user = $this->user(UserRole::Customer);
        app(PasswordResetDeliveryService::class)->request($user->email, $user->role);
        $event = TransactionalEmail::query()->sole();
        Notification::shouldReceive('sendNow')->times(5)->andThrow(new \RuntimeException('Synthetic SMTP password/token must not escape'));
        $sender = app(TransactionalEmailSender::class);
        for ($attempt = 1; $attempt <= 5; $attempt++) {
            $sender->deliver($event->id);
            $event->refresh();
            $this->assertSame($attempt, $event->attempts);
            $this->assertSame('delivery_failed', $event->last_error_code);
            if ($attempt < 5) {
                $this->assertSame(EmailDeliveryStatus::Pending, $event->status);
                $this->assertTrue($event->available_at->isFuture());
                $sender->deliver($event->id);
                $this->assertSame($attempt, $event->fresh()->attempts);
                $this->travel(11)->minutes();
            }
        }
        $this->assertSame(EmailDeliveryStatus::Failed, $event->status);
        $this->artisan('mail:status', ['--failed' => true])
            ->expectsOutputToContain($event->id)
            ->doesntExpectOutputToContain($user->email)
            ->doesntExpectOutputToContain($event->payload['token'])
            ->assertSuccessful();
        $this->assertCount(0, TransactionalEmail::query()->ready()->get());
        Log::shouldHaveReceived('warning')->with('Transactional email delivery failed.', \Mockery::on(
            fn (array $context): bool => array_keys($context) === ['email_id', 'attempt'],
        ))->times(5);

        Notification::fake();
        $this->artisan('mail:retry', ['id' => $event->id])->assertSuccessful();
        $sender->deliver($event->id);
        $this->assertSame(EmailDeliveryStatus::Accepted, $event->fresh()->status);
        $this->artisan('mail:retry', ['id' => $event->id])->assertFailed();
    }

    public function test_live_claim_blocks_reentrant_delivery_and_old_workers_cannot_finish_new_claims(): void
    {
        $user = $this->user(UserRole::Customer);
        app(PasswordResetDeliveryService::class)->request($user->email, $user->role);
        $event = TransactionalEmail::query()->sole();
        $sender = app(TransactionalEmailSender::class);
        $newClaim = (string) Str::uuid();
        Notification::shouldReceive('sendNow')->once()->andReturnUsing(function () use ($sender, $event, $newClaim): void {
            $sender->deliver($event->id);
            $this->assertSame(1, $event->fresh()->attempts);
            DB::table('transactional_emails')->where('id', $event->id)->update(['claim_token' => $newClaim]);
        });
        $sender->deliver($event->id);
        $this->assertSame(EmailDeliveryStatus::Sending, $event->fresh()->status);
        $this->assertSame($newClaim, $event->fresh()->claim_token);
        $this->assertNull($event->fresh()->accepted_at);
    }

    public function test_scheduler_recovers_expired_queue_and_sender_leases_without_duplicate_reservation(): void
    {
        Notification::fake();
        $user = $this->user(UserRole::Customer);
        app(PasswordResetDeliveryService::class)->request($user->email, $user->role);
        $event = TransactionalEmail::query()->sole();
        $dispatcher = app(TransactionalEmailDispatcher::class);
        $this->assertFalse($dispatcher->dispatch($event->id));
        $this->travel(6)->minutes();
        $this->artisan('mail:dispatch-pending')->assertSuccessful();
        $this->assertSame(EmailDeliveryStatus::Queued, $event->fresh()->status);
        $event->update(['status' => EmailDeliveryStatus::Sending, 'claim_token' => (string) Str::uuid(), 'claim_expires_at' => now()->subSecond(), 'attempts' => 1]);
        $this->artisan('mail:dispatch-pending')->assertSuccessful();
        app(TransactionalEmailSender::class)->deliver($event->id);
        $this->assertSame(EmailDeliveryStatus::Accepted, $event->fresh()->status);
        $this->assertSame(2, $event->fresh()->attempts);
    }

    public function test_identity_changes_and_deactivation_suppress_reset_delivery(): void
    {
        Notification::fake();
        foreach (['email', 'role', 'status'] as $change) {
            $user = $this->user(UserRole::Customer);
            app(PasswordResetDeliveryService::class)->request($user->email, $user->role);
            $event = TransactionalEmail::query()->where('user_id', $user->id)->sole();
            $user->update([$change => match ($change) {
                'email' => 'changed-'.$user->id.'@example.test',
                'role' => UserRole::Seller,
                'status' => UserStatus::Suspended,
            }]);
            app(TransactionalEmailSender::class)->deliver($event->id);
            $this->assertSame(EmailDeliveryStatus::Skipped, $event->fresh()->status);
        }
        Notification::assertNothingSent();
    }

    public function test_logistics_reset_remains_role_scoped_single_use_and_revokes_tokens(): void
    {
        $logistics = $this->user(UserRole::Logistics);
        $customer = $this->user(UserRole::Customer, $logistics->email);
        $originalCustomerPassword = $customer->password;
        $logistics->createToken('existing', ['logistics']);
        $this->postJson('/api/v1/logistics/auth/forgot-password', ['email' => $logistics->email])->assertOk();
        $payload = [
            'email' => $logistics->email,
            'token' => TransactionalEmail::query()->sole()->payload['token'],
            'password' => 'ReplacementPassword123',
            'password_confirmation' => 'ReplacementPassword123',
        ];
        $this->postJson('/api/v1/customer/auth/reset-password', $payload)
            ->assertUnprocessable()->assertJsonPath('code', 'INVALID_RESET_TOKEN');
        $this->postJson('/api/v1/logistics/auth/reset-password', $payload)->assertOk();
        $this->assertTrue(Hash::check('ReplacementPassword123', $logistics->fresh()->password));
        $this->assertSame($originalCustomerPassword, $customer->fresh()->password);
        $this->assertSame(0, $logistics->tokens()->count());
        $this->assertDatabaseCount('password_reset_tokens', 0);
        $this->postJson('/api/v1/logistics/auth/reset-password', $payload)
            ->assertUnprocessable()->assertJsonPath('code', 'INVALID_RESET_TOKEN');
    }

    private function user(UserRole $role, ?string $email = null): User
    {
        return User::factory()->create(['role' => $role, 'status' => UserStatus::Active, ...($email ? ['email' => $email] : [])]);
    }
}
