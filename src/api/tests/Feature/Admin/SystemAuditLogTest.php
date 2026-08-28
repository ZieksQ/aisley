<?php

namespace Tests\Feature\Admin;

use App\Enums\Admin\AuditSourceFeature;
use App\Enums\AdminAuditAction;
use App\Enums\ApplicationStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Jobs\Admin\PersistAuditLog;
use App\Models\AdminPermission;
use App\Models\AuditLog;
use App\Models\AuditOutbox;
use App\Models\Permission;
use App\Models\RegistrationApplication;
use App\Models\User;
use App\Services\Audit\AuditService;
use App\Services\Audit\AuditWriter;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use LogicException;
use RuntimeException;
use Tests\TestCase;

class SystemAuditLogTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_non_admin_and_admin_without_permission_cannot_view_audit_logs(): void
    {
        $this->getJson('/api/v1/admin/audit-logs')->assertUnauthorized();

        $customer = User::factory()->create([
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ]);
        $this->actingAs($customer)->getJson('/api/v1/admin/audit-logs')->assertForbidden();

        $this->actingAs($this->admin())
            ->getJson('/api/v1/admin/audit-logs')
            ->assertForbidden();
    }

    public function test_authorized_admin_can_list_filter_search_and_paginate_newest_first(): void
    {
        $viewer = $this->adminWithAuditPermission('viewer@example.com', 'Audit', 'Viewer');
        $otherActor = $this->admin('reviewer@example.com', 'Second', 'Reviewer');
        $oldest = $this->audit($viewer, AdminAuditAction::RegistrationApproved->value, now()->subDays(3));
        $matching = $this->audit($otherActor, AdminAuditAction::RegistrationRejected->value, now()->subDay());
        $newest = $this->audit($viewer, AdminAuditAction::RegistrationApproved->value, now());

        $this->actingAs($viewer)
            ->getJson('/api/v1/admin/audit-logs?per_page=2')
            ->assertOk()
            ->assertJsonPath('data.0.id', $newest->id)
            ->assertJsonPath('data.1.id', $matching->id)
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('meta.per_page', 2);

        $this->actingAs($viewer)
            ->getJson('/api/v1/admin/audit-logs?actor_id='.$otherActor->id
                .'&action=registration.rejected&target_type=registration_application'
                .'&from='.now()->subDays(2)->toDateString()
                .'&to='.now()->toDateString()
                .'&search='.substr($matching->id, 0, 12))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $matching->id)
            ->assertJsonPath('data.0.actor.name', 'Second Reviewer')
            ->assertJsonPath('data.0.source_feature', AuditSourceFeature::AccountApproval->value)
            ->assertJsonPath('data.0.target.type', 'registration_application')
            ->assertJsonMissing(['id' => $oldest->id]);
    }

    public function test_filter_options_return_only_supported_taxonomy_and_relevant_admins(): void
    {
        $viewer = $this->adminWithAuditPermission();
        $unusedAdmin = $this->admin('unused@example.com');
        $this->audit($viewer);

        $response = $this->actingAs($viewer)
            ->getJson('/api/v1/admin/audit-logs/options')
            ->assertOk()
            ->assertJsonPath('actors.0.id', $viewer->id)
            ->assertJsonPath('source_features.0.value', 'account_approval')
            ->assertJsonPath('actions.0.value', 'registration.approved')
            ->assertJsonPath('target_types.0.value', 'registration_application')
            ->assertJsonFragment([
                'value' => 'admin_authentication',
                'label' => 'Admin Authentication',
            ])
            ->assertJsonFragment([
                'value' => 'admin.login_succeeded',
                'label' => 'Admin signed in',
            ])
            ->assertJsonFragment([
                'value' => 'admin_account',
                'label' => 'Admin account',
            ]);

        $this->assertNotContains($unusedAdmin->id, collect($response->json('actors'))->pluck('id'));
    }

    public function test_audit_detail_returns_structured_safe_history_and_handles_unknown_actions(): void
    {
        $viewer = $this->adminWithAuditPermission();
        $audit = $this->audit($viewer, 'legacy.security_action', now(), [
            'old_values' => ['account_status' => 'pending'],
            'new_values' => ['account_status' => 'active'],
            'changed_fields' => ['account_status'],
            'metadata' => ['decision' => 'approved'],
            'request_id' => 'request-123',
            'ip_address' => '127.0.0.1',
            'user_agent' => 'Audit test agent',
        ]);

        $this->actingAs($viewer)
            ->getJson("/api/v1/admin/audit-logs/{$audit->id}")
            ->assertOk()
            ->assertJsonPath('data.action', 'legacy.security_action')
            ->assertJsonPath('data.action_label', 'Legacy Security Action')
            ->assertJsonPath('data.changes.before.account_status', 'pending')
            ->assertJsonPath('data.changes.after.account_status', 'active')
            ->assertJsonPath('data.metadata.decision', 'approved')
            ->assertJsonPath('data.request_context.request_id', 'request-123')
            ->assertJsonMissingPath('data.password')
            ->assertJsonMissingPath('data.update_url');
    }

    public function test_audit_logs_have_no_update_or_delete_api_and_are_append_only(): void
    {
        $viewer = $this->adminWithAuditPermission();
        $audit = $this->audit($viewer);

        $this->actingAs($viewer)
            ->patchJson("/api/v1/admin/audit-logs/{$audit->id}", ['action' => 'changed'])
            ->assertMethodNotAllowed();
        $this->actingAs($viewer)
            ->deleteJson("/api/v1/admin/audit-logs/{$audit->id}")
            ->assertMethodNotAllowed();

        try {
            $audit->update(['action' => 'changed']);
            $this->fail('The AuditLog model allowed an update.');
        } catch (LogicException) {
            $this->assertSame(AdminAuditAction::RegistrationApproved->value, $audit->fresh()->action);
        }

        $this->expectException(QueryException::class);
        DB::table('audit_logs')->where('id', $audit->id)->delete();
    }

    public function test_audit_service_queues_a_safe_outbox_event_after_commit(): void
    {
        Queue::fake();
        $admin = $this->admin();
        $registration = $this->registration();
        $occurredAt = now()->subMinute();

        $eventId = DB::transaction(fn () => app(AuditService::class)->record(
            actor: $admin,
            action: AdminAuditAction::RegistrationApproved,
            sourceFeature: AuditSourceFeature::AccountApproval,
            target: $registration,
            before: [
                'account_status' => 'pending',
                'password' => 'should-not-appear',
            ],
            after: [
                'account_status' => 'active',
                'access_token' => 'should-not-appear',
            ],
            targetSnapshot: [
                'role' => UserRole::Customer->value,
                'raw_evidence' => 'private-image-data',
            ],
            occurredAt: $occurredAt,
        ));

        $this->assertDatabaseHas('audit_outbox', ['id' => $eventId]);
        $this->assertDatabaseMissing('audit_logs', ['id' => $eventId]);
        Queue::assertPushed(PersistAuditLog::class, fn (PersistAuditLog $job) => $job->eventId === $eventId);

        app(AuditWriter::class)->persist($eventId);

        $audit = AuditLog::findOrFail($eventId);
        $this->assertSame('[REDACTED]', $audit->old_values['password']);
        $this->assertSame('[REDACTED]', $audit->new_values['access_token']);
        $this->assertSame('[REDACTED]', $audit->target_snapshot['raw_evidence']);
        $this->assertEquals($occurredAt->toDateTimeString(), $audit->occurred_at->toDateTimeString());
        $this->assertNotNull(AuditOutbox::findOrFail($eventId)->processed_at);
    }

    public function test_rolled_back_business_transaction_does_not_leave_false_audit_event(): void
    {
        Queue::fake();
        $admin = $this->admin();
        $registration = $this->registration();

        try {
            DB::transaction(function () use ($admin, $registration): void {
                app(AuditService::class)->record(
                    actor: $admin,
                    action: AdminAuditAction::RegistrationRejected,
                    sourceFeature: AuditSourceFeature::AccountApproval,
                    target: $registration,
                );

                throw new RuntimeException('Roll back the business action.');
            });
        } catch (RuntimeException) {
            // Expected rollback.
        }

        $this->assertDatabaseCount('audit_outbox', 0);
        $this->assertDatabaseCount('audit_logs', 0);
        Queue::assertNothingPushed();
    }

    public function test_duplicate_outbox_delivery_creates_only_one_audit_record(): void
    {
        Queue::fake();
        $eventId = app(AuditService::class)->record(
            actor: $this->admin(),
            action: AdminAuditAction::RegistrationApproved,
            sourceFeature: AuditSourceFeature::AccountApproval,
            target: $this->registration(),
        );

        $writer = app(AuditWriter::class);
        $writer->persist($eventId);
        $writer->persist($eventId);

        $this->assertDatabaseCount('audit_logs', 1);
        $this->assertDatabaseCount('audit_outbox', 1);
    }

    public function test_deleted_or_deactivated_actor_history_remains_attributable(): void
    {
        $viewer = $this->adminWithAuditPermission();
        $actor = $this->admin('historical@example.com', 'History', 'Keeper');
        $audit = $this->audit($actor);

        $actor->update(['status' => UserStatus::Deactivated]);
        $this->actingAs($viewer)
            ->getJson("/api/v1/admin/audit-logs/{$audit->id}")
            ->assertOk()
            ->assertJsonPath('data.actor.name', 'History Keeper');

        $actor->delete();
        $this->actingAs($viewer)
            ->getJson("/api/v1/admin/audit-logs/{$audit->id}")
            ->assertOk()
            ->assertJsonPath('data.actor.name', 'History Keeper');

        $this->actingAs($viewer)
            ->getJson('/api/v1/admin/audit-logs/options')
            ->assertOk()
            ->assertJsonFragment([
                'id' => $actor->id,
                'name' => 'History Keeper',
                'email' => null,
            ]);
    }

    public function test_pending_outbox_dispatch_command_recovers_unprocessed_events(): void
    {
        Queue::fake();
        $eventId = app(AuditService::class)->record(
            actor: $this->admin(),
            action: AdminAuditAction::RegistrationApproved,
            sourceFeature: AuditSourceFeature::AccountApproval,
            target: $this->registration(),
        );
        Queue::fake();

        $this->artisan('audit:dispatch-pending')->assertSuccessful();

        Queue::assertPushed(PersistAuditLog::class, fn (PersistAuditLog $job) => $job->eventId === $eventId);
    }

    private function admin(
        ?string $email = null,
        string $firstName = 'Avery',
        string $lastName = 'Admin',
    ): User {
        $admin = User::factory()->create([
            'email' => $email ?? fake()->unique()->safeEmail(),
            'role' => UserRole::Admin,
            'status' => UserStatus::Active,
        ]);
        $admin->adminProfile()->create([
            'first_name' => $firstName,
            'last_name' => $lastName,
        ]);

        return $admin;
    }

    private function adminWithAuditPermission(
        ?string $email = null,
        string $firstName = 'Avery',
        string $lastName = 'Admin',
    ): User {
        $admin = $this->admin($email, $firstName, $lastName);
        $permission = Permission::query()->firstOrCreate(
            ['slug' => 'audit-logs.view'],
            ['name' => 'View system audit logs'],
        );
        AdminPermission::create([
            'admin_id' => $admin->id,
            'permission_id' => $permission->id,
        ]);

        return $admin;
    }

    /** @param array<string, mixed> $overrides */
    private function audit(
        User $actor,
        string $action = AdminAuditAction::RegistrationApproved->value,
        mixed $occurredAt = null,
        array $overrides = [],
    ): AuditLog {
        $registration = $this->registration();

        return AuditLog::create([
            'actor_id' => $actor->id,
            'actor_name' => trim($actor->adminProfile->first_name.' '.$actor->adminProfile->last_name),
            'action' => $action,
            'source_feature' => AuditSourceFeature::AccountApproval->value,
            'auditable_type' => RegistrationApplication::class,
            'auditable_id' => $registration->id,
            'target_snapshot' => [
                'role' => UserRole::Customer->value,
                'account_id' => $registration->user_id,
            ],
            'old_values' => ['application_status' => 'pending'],
            'new_values' => ['application_status' => 'approved'],
            'changed_fields' => ['application_status'],
            'metadata' => [],
            'schema_version' => 1,
            'occurred_at' => $occurredAt ?? now(),
            'created_at' => now(),
            ...$overrides,
        ]);
    }

    private function registration(): RegistrationApplication
    {
        $customer = User::factory()->create([
            'role' => UserRole::Customer,
            'status' => UserStatus::Pending,
        ]);

        return RegistrationApplication::create([
            'user_id' => $customer->id,
            'application_type' => UserRole::Customer,
            'status' => ApplicationStatus::Pending,
            'submitted_at' => now(),
        ]);
    }
}
