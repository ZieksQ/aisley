<?php

namespace Tests\Feature\Support;

use App\Enums\PlatformPolicyType;
use App\Enums\PlatformPolicyVersionStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AdminPermission;
use App\Models\Permission;
use App\Models\PlatformPolicy;
use App\Models\SupportTicket;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class LogisticsTicketStatusTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_resolve_and_reopen_with_public_history_and_exact_retries(): void
    {
        $owner = $this->account();
        $ticket = $this->ticket($owner);
        $path = $this->path($ticket);
        $key = (string) Str::uuid();
        $input = ['status' => 'resolved', 'reason' => '  We received the parcel.  ', 'expected_revision' => 1];

        $saved = $this->actingAs($owner)->postJson($path, $input, ['Idempotency-Key' => $key])
            ->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.status', 'resolved')->assertJsonPath('data.revision', 2)
            ->assertJsonPath('event.type', 'status')->assertJsonPath('event.actor_role', 'logistics')
            ->assertJsonPath('event.from_status', 'open')->assertJsonPath('event.to_status', 'resolved')
            ->assertJsonPath('event.body', 'We received the parcel.');
        $this->assertNotNull($saved->json('data.resolved_at'));
        $this->postJson($path, $input, ['Idempotency-Key' => $key])->assertOk()
            ->assertExactJson($saved->json());
        $this->postJson($path, [...$input, 'reason' => 'Changed'], ['Idempotency-Key' => $key])->assertConflict();
        $this->postJson($path, $input, ['Idempotency-Key' => (string) Str::uuid()])->assertConflict();
        $this->assertDatabaseCount('support_ticket_events', 2);

        $this->postJson($path, ['status' => 'open', 'reason' => '0', 'expected_revision' => 2], $this->headers())
            ->assertOk()->assertJsonPath('data.status', 'open')->assertJsonPath('data.resolved_at', null)
            ->assertJsonPath('event.from_status', 'resolved')->assertJsonPath('event.to_status', 'open')
            ->assertJsonPath('event.body', '0');
        $this->assertDatabaseCount('support_ticket_events', 3);
    }

    public function test_status_changes_enforce_owner_role_account_and_existing_app_gates(): void
    {
        $this->postJson($this->path((string) Str::uuid()), [], $this->headers())->assertUnauthorized();
        $owner = $this->account();
        $ticket = $this->ticket($owner);
        $input = ['status' => 'resolved', 'reason' => 'Done.', 'expected_revision' => 1];
        $this->actingAs($this->account())->postJson($this->path($ticket), $input, $this->headers())->assertNotFound();
        foreach ([UserRole::Customer, UserRole::Seller, UserRole::Admin, UserRole::Courier] as $role) {
            $actor = $this->account($role);
            $this->actingAs($actor)->postJson($this->path($ticket), $input, $this->headers())->assertForbidden();
            if ($role !== UserRole::Admin) {
                $this->postJson("/api/v1/{$role->value}/support-tickets/{$ticket}/status", $input, $this->headers())->assertNotFound();
            }
        }
        foreach ([UserStatus::Pending, UserStatus::Rejected, UserStatus::Suspended] as $status) {
            $owner->update(['status' => $status]);
            $this->actingAs($owner->fresh())->postJson($this->path($ticket), $input, $this->headers())->assertForbidden();
        }
        $this->assertDatabaseCount('support_ticket_events', 1);
    }

    public function test_status_change_requires_current_policy_consent(): void
    {
        $owner = $this->account();
        $ticket = $this->ticket($owner);
        $admin = $this->admin();
        $policy = PlatformPolicy::create(['type' => PlatformPolicyType::TermsOfService]);
        $version = $policy->versions()->create([
            'version' => 1, 'title' => 'Terms', 'content' => 'Read the terms.',
            'status' => PlatformPolicyVersionStatus::Published, 'requires_reconsent' => true,
            'revision' => 1, 'created_by_admin_id' => $admin->id, 'published_by_admin_id' => $admin->id, 'published_at' => now(),
        ]);
        $policy->update(['current_version_id' => $version->id]);
        $this->actingAs($owner)->postJson($this->path($ticket), [
            'status' => 'resolved', 'reason' => 'Done.', 'expected_revision' => 1,
        ], $this->headers())->assertForbidden()->assertJsonPath('code', 'POLICY_CONSENT_REQUIRED');
        $this->assertDatabaseCount('support_ticket_events', 1);
    }

    public function test_validation_disallows_admin_work_statuses_missing_reason_and_undeclared_input(): void
    {
        $owner = $this->account();
        $ticket = $this->ticket($owner);
        $this->actingAs($owner);
        $input = ['status' => 'resolved', 'reason' => 'Done.', 'expected_revision' => 1];
        foreach (['in_progress', 'waiting_for_requester', 'open'] as $status) {
            $this->postJson($this->path($ticket), [...$input, 'status' => $status], $this->headers())->assertUnprocessable();
        }
        foreach (['', '  ', null, str_repeat('x', 2001)] as $reason) {
            $this->postJson($this->path($ticket), [...$input, 'reason' => $reason], $this->headers())->assertUnprocessable();
        }
        $this->postJson($this->path($ticket), $input)->assertUnprocessable()->assertJsonValidationErrors('idempotency_key');
        $this->postJson($this->path($ticket), [...$input, 'assignee_id' => Str::uuid()], $this->headers())->assertUnprocessable();
        $this->postJson($this->path($ticket), [...$input, 'expected_revision' => 0], $this->headers())->assertUnprocessable();
        $this->assertDatabaseCount('support_ticket_events', 1);
    }

    public function test_resolving_supported_work_states_preserves_assignment_and_notifies_only_eligible_admin(): void
    {
        $owner = $this->account();
        $assigned = $this->admin();
        $other = $this->admin();
        foreach (['in_progress', 'waiting_for_requester'] as $status) {
            $ticket = $this->ticket($owner);
            SupportTicket::query()->whereKey($ticket)->update(['status' => $status, 'assignee_user_id' => $assigned->id]);
            $input = ['status' => 'resolved', 'reason' => 'Private reason body.', 'expected_revision' => 1];
            $key = $this->headers();
            $this->actingAs($owner)->postJson($this->path($ticket), $input, $key)->assertOk();
            $this->assertDatabaseHas('support_tickets', ['id' => $ticket, 'assignee_user_id' => $assigned->id]);
            $this->postJson($this->path($ticket), $input, $key)->assertOk();
            $notification = $assigned->notifications()->where('type', 'support-ticket.status-changed')
                ->where('data->resource_id', $ticket)->sole();
            $this->assertStringNotContainsString('Private reason body', json_encode($notification->data));
            $this->assertSame("/support-tickets/{$ticket}", $notification->data['destination']);
            $this->actingAs($assigned)->getJson("/api/v1/admin/support-tickets/{$ticket}")->assertOk()
                ->assertJsonPath('data.unread_count', 2);
        }
        $this->assertSame(0, $other->notifications()->where('type', 'support-ticket.status-changed')->count());
        $this->assertSame(0, $owner->notifications()->where('type', 'support-ticket.status-changed')->count());
    }

    public function test_unassigned_status_change_reaches_admin_team_and_automatic_reopen_does_not_emit_extra_status_alert(): void
    {
        $owner = $this->account();
        $first = $this->admin();
        $second = $this->admin();
        $ticket = $this->ticket($owner);
        $this->actingAs($owner)->postJson($this->path($ticket), [
            'status' => 'resolved', 'reason' => 'Done.', 'expected_revision' => 1,
        ], $this->headers())->assertOk();
        $this->postJson("/api/v1/logistics/support-tickets/{$ticket}/replies", [
            'body' => 'Still need help.', 'expected_revision' => 2,
        ], $this->headers())->assertCreated()->assertJsonPath('data.status', 'open');
        foreach ([$first, $second] as $admin) {
            $this->assertSame(1, $admin->notifications()->where('type', 'support-ticket.status-changed')->count());
            $this->actingAs($admin)->getJson("/api/v1/admin/support-tickets/{$ticket}")->assertOk()
                ->assertJsonPath('data.unread_count', 3);
        }
    }

    private function account(UserRole $role = UserRole::Logistics): User
    {
        return User::factory()->create(['role' => $role, 'status' => UserStatus::Active]);
    }

    private function admin(): User
    {
        $admin = $this->account(UserRole::Admin);
        foreach (['support-tickets.view', 'notifications.view'] as $slug) {
            $permission = Permission::query()->firstOrCreate(['slug' => $slug], ['name' => $slug]);
            AdminPermission::query()->create(['admin_id' => $admin->id, 'permission_id' => $permission->id]);
        }

        return $admin;
    }

    private function ticket(User $owner): string
    {
        return $this->actingAs($owner)->postJson('/api/v1/logistics/support-tickets', [
            'subject' => 'Handover', 'category' => 'delivery', 'body' => 'Please help.',
        ], $this->headers())->assertCreated()->json('data.id');
    }

    private function path(string $ticket): string
    {
        return "/api/v1/logistics/support-tickets/{$ticket}/status";
    }

    private function headers(): array
    {
        return ['Idempotency-Key' => (string) Str::uuid()];
    }
}
