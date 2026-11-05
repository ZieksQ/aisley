<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AdminRole;
use App\Models\AdminSetupChallenge;
use App\Models\Permission;
use App\Models\TransactionalEmail;
use App\Models\User;
use App\Notifications\Admin\SetupCodeNotification;
use App\Services\Admin\Provisioning\AdminProvisioningService;
use App\Services\Admin\Provisioning\AdminRoleService;
use App\Services\Admin\Provisioning\AdminSetupService;
use App\Services\Mail\TransactionalEmailNotificationFactory;
use App\Services\Mail\TransactionalEmailSender;
use Database\Seeders\AdminPermissionSeeder;
use Database\Seeders\InitialAdminSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Tests\TestCase;

class AdminProvisioningSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(AdminPermissionSeeder::class);
    }

    public function test_bootstrap_reconciliation_preserves_credentials_and_grants_future_permissions(): void
    {
        $admin = $this->admin();
        config()->set('admin.initial.email', $admin->email);
        config()->set('admin.initial.password', null);
        $this->seed(InitialAdminSeeder::class);
        $admin->refresh();
        $this->assertTrue($admin->is_initial_admin);
        $this->assertTrue($admin->is_super_admin);
        $this->assertFalse($admin->requiresAdminSetup());
        $this->assertTrue(Hash::check('Manager123', $admin->password));
        Permission::create(['name' => 'Future feature', 'slug' => 'future-feature.view']);
        $this->assertTrue($admin->hasAdminPermission('future-feature.view'));
        $this->assertTrue(User::withAdminPermission('future-feature.view')->whereKey($admin->id)->exists());
        config()->set('admin.initial.email', 'replacement@example.com');
        config()->set('admin.initial.password', 'Manager123');
        try {
            $this->seed(InitialAdminSeeder::class);
            $this->fail('Bootstrap identity was replaced.');
        } catch (\RuntimeException) {
            $this->assertDatabaseMissing('users', ['email' => 'replacement@example.com']);
        }
    }

    public function test_only_super_admin_can_promote_and_initial_admin_cannot_be_demoted(): void
    {
        $super = $this->admin(true);
        $manager = $this->admin();
        $manager->permissions()->sync(Permission::pluck('id'));
        $service = app(AdminProvisioningService::class);
        $data = $this->draft(['is_super_admin' => true]);
        try {
            $service->create($manager, $data);
            $this->fail('Non-super promotion allowed.');
        } catch (HttpExceptionInterface $error) {
            $this->assertSame(403, $error->getStatusCode());
        }
        $target = $service->create($super, $data);
        $this->assertTrue($target->is_super_admin);
        $target->forceFill(['is_initial_admin' => true])->save();
        try {
            $service->update($super, $target, $this->draft(['revision' => 0, 'is_super_admin' => false]));
            $this->fail('Initial super admin demoted.');
        } catch (HttpExceptionInterface $error) {
            $this->assertSame(403, $error->getStatusCode());
        }
    }

    public function test_role_updates_cannot_indirectly_change_a_stronger_account_and_stale_role_updates_fail(): void
    {
        $manager = $this->admin();
        $manager->permissions()->sync(Permission::whereIn('slug', ['admin-accounts.update', 'finance.view'])->pluck('id'));
        $role = AdminRole::create(['name' => 'Shared finance']);
        $role->permissions()->sync(Permission::where('slug', 'finance.view')->pluck('id'));
        $member = $this->admin();
        $member->permissions()->sync(Permission::where('slug', 'finance.manage')->pluck('id'));
        $member->adminRoles()->attach($role);
        $data = ['name' => 'Changed', 'permissions' => [], 'revision' => 0, 'current_password' => 'Manager123'];
        try {
            app(AdminRoleService::class)->save($manager, $data, $role);
            $this->fail('Indirect stronger-account edit allowed.');
        } catch (HttpExceptionInterface $error) {
            $this->assertSame(403, $error->getStatusCode());
        }
        $super = $this->admin(true);
        $saved = app(AdminRoleService::class)->save($super, $data, $role);
        $this->assertSame(1, (int) $saved->revision);
        $this->assertSame(1, $member->refresh()->admin_revision);
        try {
            app(AdminRoleService::class)->save($super, $data, $role);
            $this->fail('Stale role revision allowed.');
        } catch (HttpExceptionInterface $error) {
            $this->assertSame(409, $error->getStatusCode());
        }
    }

    public function test_duplicate_admin_email_is_rejected_but_other_role_identity_can_coexist(): void
    {
        $super = $this->admin(true);
        User::factory()->create(['email' => 'created@example.com', 'role' => UserRole::Customer]);
        app(AdminProvisioningService::class)->create($super, $this->draft());
        try {
            app(AdminProvisioningService::class)->create($super, $this->draft());
            $this->fail('Duplicate admin created.');
        } catch (ValidationException $error) {
            $this->assertArrayHasKey('email', $error->errors());
        }
        $this->assertSame(2, User::where('email', 'created@example.com')->count());
    }

    public function test_otp_resend_hourly_limit_and_supersession_are_durable(): void
    {
        $user = $this->pending();
        $service = app(AdminSetupService::class);
        $first = $service->request($user, $this->setupData());
        $firstMail = TransactionalEmail::latest()->first();
        $this->travel(61)->seconds();
        for ($i = 0; $i < 4; $i++) {
            $service->request($user, $this->setupData());
            $this->travel(61)->seconds();
        }
        $this->assertNotNull(AdminSetupChallenge::find($first['challenge_id'])->invalidated_at);
        $this->assertNull(app(TransactionalEmailNotificationFactory::class)->make($firstMail, $user));
        try {
            $service->request($user, $this->setupData());
            $this->fail('Hourly limit bypassed.');
        } catch (HttpExceptionInterface $error) {
            $this->assertSame(429, $error->getStatusCode());
            $this->assertArrayHasKey('Retry-After', $error->getHeaders());
        }
        $this->travel(1)->hours();
        $this->assertArrayHasKey('challenge_id', $service->request($user, $this->setupData()));
    }

    public function test_identity_changes_and_completed_challenges_cannot_be_replayed(): void
    {
        $user = $this->pending();
        $service = app(AdminSetupService::class);
        $challenge = $service->request($user, $this->setupData());
        $code = TransactionalEmail::latest()->first()->payload['code'];
        $user->forceFill(['email' => 'different@example.com'])->save();
        try {
            $service->complete($user, $this->setupData() + ['challenge_id' => $challenge['challenge_id'], 'verification_code' => $code]);
            $this->fail('Old identity verified.');
        } catch (ValidationException) {
            $this->assertTrue($user->refresh()->admin_setup_required);
        }
        $this->travel(61)->seconds();
        $challenge = $service->request($user, $this->setupData());
        $code = TransactionalEmail::latest()->first()->payload['code'];
        $data = $this->setupData() + ['challenge_id' => $challenge['challenge_id'], 'verification_code' => $code];
        $service->complete($user, $data);
        try {
            $service->complete($user, $data);
            $this->fail('Completed setup replayed.');
        } catch (HttpExceptionInterface $error) {
            $this->assertSame(409, $error->getStatusCode());
        }
        $this->assertSame(1, $user->refresh()->admin_session_version);
    }

    public function test_mail_failure_keeps_setup_pending_and_retry_does_not_mutate_credentials(): void
    {
        $user = $this->pending();
        app(AdminSetupService::class)->request($user, $this->setupData());
        $mail = TransactionalEmail::latest()->firstOrFail();
        Notification::shouldReceive('sendNow')->once()->andThrow(new \RuntimeException('Synthetic mail outage'));
        app(TransactionalEmailSender::class)->deliver($mail->id);
        $this->assertTrue($user->refresh()->requiresAdminSetup());
        $this->assertTrue(Hash::check('Manager123', $user->password));
        $this->assertSame('pending', $mail->refresh()->status->value);
        $this->assertNotNull($mail->payload);
        $this->assertStringNotContainsString('Synthetic mail outage', (string) $mail->last_error_code);
        $this->assertNull(DB::table('users')->where('id', $user->id)->value('email_verified_at'));
    }

    public function test_setup_email_delivery_clears_payload_without_activating_the_account(): void
    {
        Notification::fake();
        $user = $this->pending();
        app(AdminSetupService::class)->request($user, $this->setupData());
        $mail = TransactionalEmail::latest()->firstOrFail();
        $code = $mail->payload['code'];
        app(TransactionalEmailSender::class)->deliver($mail->id);
        Notification::assertSentTo($user, SetupCodeNotification::class,
            function ($notification) use ($user, $code): bool {
                $message = $notification->toMail($user);
                $this->assertContains($code, $message->introLines);

                return true;
            });
        $this->assertSame('accepted', $mail->refresh()->status->value);
        $this->assertNull($mail->payload);
        $this->assertTrue($user->refresh()->requiresAdminSetup());
    }

    public function test_unassigned_role_deletion_retains_searchable_audit_history(): void
    {
        $admin = $this->admin(true);
        $role = app(AdminRoleService::class)->save($admin, ['name' => 'Temporary role', 'permissions' => [], 'current_password' => 'Manager123']);
        app(AdminRoleService::class)->delete($admin, $role, (int) $role->revision, 'Manager123');
        $this->assertDatabaseMissing('admin_roles', ['id' => $role->id]);
        $this->actingAs($admin, 'web')->getJson('/api/v1/admin/audit-logs?target_type=admin_role&target_id='.$role->id)
            ->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.0.target.type', 'admin_role');
    }

    private function admin(bool $super = false): User
    {
        $user = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active, 'password' => 'Manager123']);
        $user->forceFill(['is_super_admin' => $super])->save();

        return $user->refresh();
    }

    private function pending(): User
    {
        $user = $this->admin();
        $user->forceFill(['admin_setup_required' => true, 'admin_email_verification_required' => true, 'email_verified_at' => null])->save();

        return $user->refresh();
    }

    private function draft(array $overrides = []): array
    {
        return array_replace(['email' => 'created@example.com', 'first_name' => 'Created', 'last_name' => 'Admin', 'password' => 'Temporary123',
            'current_password' => 'Manager123', 'permissions' => [], 'role_ids' => []], $overrides);
    }

    private function setupData(): array
    {
        return ['current_password' => 'Manager123', 'password' => 'Replacement456'];
    }
}
