<?php

namespace Tests\Feature\Mail;

use App\Enums\ApplicationStatus;
use App\Enums\EmailDeliveryStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\TransactionalEmail;
use App\Models\User;
use App\Services\Admin\RegistrationReviewService;
use App\Services\Mail\PasswordResetDeliveryService;
use App\Services\Mail\TransactionalEmailSender;
use Illuminate\Foundation\Testing\RefreshDatabaseState;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class TransactionalEmailTransactionsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // Real commit boundaries, with a disposable in-memory database. Avoid
        // rolling back unrelated legacy migrations whose SQLite downs fail.
        $this->artisan('migrate:fresh')->assertSuccessful();
    }

    protected function tearDown(): void
    {
        RefreshDatabaseState::$migrated = false;
        parent::tearDown();
    }

    public function test_outer_rollback_removes_reset_token_and_email_and_never_dispatches(): void
    {
        $user = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        DB::beginTransaction();
        app(PasswordResetDeliveryService::class)->request($user->email, $user->role);
        $this->assertDatabaseCount('transactional_emails', 1);
        $this->assertDatabaseCount('password_reset_tokens', 1);
        $this->assertDatabaseCount('jobs', 0);
        DB::rollBack();
        $this->assertDatabaseCount('transactional_emails', 0);
        $this->assertDatabaseCount('password_reset_tokens', 0);
        $this->assertDatabaseCount('jobs', 0);
    }

    public function test_reset_only_dispatches_after_the_outer_transaction_commits(): void
    {
        $user = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
        DB::beginTransaction();
        app(PasswordResetDeliveryService::class)->request($user->email, $user->role);
        $this->assertDatabaseCount('jobs', 0);
        $this->assertSame(EmailDeliveryStatus::Pending, TransactionalEmail::query()->sole()->status);
        DB::commit();
        $this->assertDatabaseCount('jobs', 1);
        $this->assertSame(EmailDeliveryStatus::Queued, TransactionalEmail::query()->sole()->status);
    }

    public function test_registration_and_email_intent_roll_back_together(): void
    {
        $user = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Pending]);
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $application = $user->registrationApplications()->create(['application_type' => $user->role, 'status' => ApplicationStatus::Pending, 'submitted_at' => now()]);
        DB::beginTransaction();
        app(RegistrationReviewService::class)->decide($application, $admin, ApplicationStatus::Approved, null, null, null);
        $this->assertDatabaseCount('transactional_emails', 1);
        $this->assertDatabaseCount('jobs', 0);
        DB::rollBack();
        $this->assertSame(UserStatus::Pending, $user->fresh()->status);
        $this->assertSame(ApplicationStatus::Pending, $application->fresh()->status);
        $this->assertDatabaseCount('transactional_emails', 0);
        $this->assertDatabaseCount('jobs', 0);
    }

    public function test_committed_logistics_approval_survives_smtp_outage(): void
    {
        $user = User::factory()->create(['role' => UserRole::Logistics, 'status' => UserStatus::Pending]);
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $application = $user->registrationApplications()->create(['application_type' => $user->role, 'status' => ApplicationStatus::Pending, 'submitted_at' => now()]);
        app(RegistrationReviewService::class)->decide($application, $admin, ApplicationStatus::Approved, null, null, null);
        Notification::shouldReceive('sendNow')->once()->andThrow(new \RuntimeException('Synthetic SMTP outage'));
        $event = TransactionalEmail::query()->sole();
        app(TransactionalEmailSender::class)->deliver($event->id);
        $this->assertSame(ApplicationStatus::Approved, $application->fresh()->status);
        $this->assertSame(UserStatus::Active, $user->fresh()->status);
        $this->assertSame(EmailDeliveryStatus::Pending, $event->fresh()->status);
        $this->assertSame('delivery_failed', $event->fresh()->last_error_code);
    }

    public function test_committed_registration_is_recoverable_when_queue_dispatch_fails(): void
    {
        $user = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Pending]);
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $application = $user->registrationApplications()->create(['application_type' => $user->role, 'status' => ApplicationStatus::Pending, 'submitted_at' => now()]);
        Bus::shouldReceive('dispatch')->andThrow(new \RuntimeException('Synthetic queue outage'));
        app(RegistrationReviewService::class)->decide($application, $admin, ApplicationStatus::Rejected, 'Unreadable evidence.', null, null);
        $this->assertSame(ApplicationStatus::Rejected, $application->fresh()->status);
        $this->assertSame(UserStatus::Rejected, $user->fresh()->status);
        $event = TransactionalEmail::query()->sole();
        $this->assertSame(EmailDeliveryStatus::Pending, $event->status);
        $this->assertSame('queue_unavailable', $event->last_error_code);
    }
}
