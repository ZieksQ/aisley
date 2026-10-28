<?php

namespace Tests\Feature\Support;

use App\Enums\SupportTicketStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Jobs\Support\DeliverSupportTicketNotification;
use App\Models\AdminPermission;
use App\Models\Permission;
use App\Models\SupportTicketEvent;
use App\Models\User;
use App\Services\Support\SupportTicketNotificationPresenter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Ramsey\Uuid\Uuid;
use Tests\TestCase;

class SupportTicketNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_ticket_events_notify_only_current_eligible_recipients_with_safe_deduplicated_payloads(): void
    {
        $customer = $this->account(UserRole::Customer);
        $assignedAdmin = $this->admin('assigned@example.com', 'notifications.view', 'support-tickets.view', 'support-tickets.manage');
        $otherAdmin = $this->admin('other@example.com', 'notifications.view', 'support-tickets.view');
        $ineligibleAdmin = $this->admin('ineligible@example.com', 'notifications.view');
        $createKey = (string) Str::uuid();
        $payload = ['subject' => 'Cannot open an order', 'category' => 'order', 'body' => 'The private customer message.'];

        $created = $this->actingAs($customer)->postJson('/api/v1/customer/support-tickets', $payload, ['Idempotency-Key' => $createKey])
            ->assertCreated();
        $ticketId = $created->json('data.id');
        $this->assertSame(0, $customer->notifications()->count());
        $this->actingAs($customer)->postJson('/api/v1/customer/support-tickets', $payload, ['Idempotency-Key' => $createKey])
            ->assertCreated()->assertJsonPath('data.id', $ticketId);

        $createEvent = SupportTicketEvent::query()->where('ticket_id', $ticketId)->where('sequence', 1)->firstOrFail();
        $createdNotification = $assignedAdmin->notifications()->where('type', 'support-ticket.created')->sole();
        $expectedId = Uuid::uuid5(
            Uuid::NAMESPACE_URL,
            "aisley:support-ticket:{$assignedAdmin->id}:{$createEvent->id}:support-ticket.created",
        )->toString();
        $this->assertSame($expectedId, (string) $createdNotification->id);
        $this->assertSame(1, $otherAdmin->notifications()->where('type', 'support-ticket.created')->count());
        $this->assertSame(0, $ineligibleAdmin->notifications()->count());
        $this->assertSame('support_ticket', $createdNotification->data['resource_type']);
        $this->assertSame($ticketId, $createdNotification->data['resource_id']);
        $this->assertStringContainsString($created->json('data.reference'), $createdNotification->data['summary']);
        $this->assertArrayNotHasKey('body', $createdNotification->data);
        $this->assertArrayNotHasKey('subject', $createdNotification->data);
        $this->assertStringNotContainsString('private customer message', json_encode($createdNotification->data));
        (new DeliverSupportTicketNotification($ticketId, (string) $createEvent->id, 'support-ticket.created'))
            ->handle(app(SupportTicketNotificationPresenter::class));
        $this->assertSame(1, $assignedAdmin->notifications()->where('type', 'support-ticket.created')->count());

        $this->actingAs($customer)->postJson("/api/v1/customer/support-tickets/{$ticketId}/replies", [
            'body' => 'I still cannot open it.', 'expected_revision' => 1,
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertCreated();
        $this->assertSame(0, $customer->notifications()->where('type', 'support-ticket.requester-replied')->count());
        $this->assertSame(1, $assignedAdmin->notifications()->where('type', 'support-ticket.requester-replied')->count(), 'first requester reply should reach each eligible Admin once');
        $this->assertSame(1, $otherAdmin->notifications()->where('type', 'support-ticket.requester-replied')->count(), 'first requester reply should reach each eligible Admin once');

        $this->actingAs($assignedAdmin)->postJson("/api/v1/admin/support-tickets/{$ticketId}/claim", [
            'expected_revision' => 2,
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertOk()->assertJsonPath('data.revision', 4);
        $this->assertSame(1, $assignedAdmin->notifications()->where('type', 'support-ticket.requester-replied')->count(), 'claim must not emit an assignment notification');
        $this->assertSame(1, $otherAdmin->notifications()->where('type', 'support-ticket.requester-replied')->count(), 'claim must not emit an assignment notification');
        $this->assertSame(0, $assignedAdmin->notifications()->where('type', 'support-ticket.admin-replied')->count());

        $this->actingAs($customer)->postJson("/api/v1/customer/support-tickets/{$ticketId}/replies", [
            'body' => 'The issue continues.', 'expected_revision' => 4,
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertCreated();
        $this->assertSame(2, $assignedAdmin->notifications()->where('type', 'support-ticket.requester-replied')->count());
        $this->assertSame(1, $otherAdmin->notifications()->where('type', 'support-ticket.requester-replied')->count());

        $this->actingAs($assignedAdmin)->postJson("/api/v1/admin/support-tickets/{$ticketId}/replies", [
            'body' => 'Support is checking this.', 'expected_revision' => 5,
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertCreated();
        $this->assertSame(1, $customer->notifications()->where('type', 'support-ticket.admin-replied')->count());
        $this->assertSame(0, $assignedAdmin->notifications()->where('type', 'support-ticket.admin-replied')->count());

        $this->actingAs($assignedAdmin)->postJson("/api/v1/admin/support-tickets/{$ticketId}/status", [
            'status' => SupportTicketStatus::WaitingForRequester->value,
            'expected_revision' => 6,
            'reason' => 'Please confirm whether the issue continues.',
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertOk();
        $this->assertSame(1, $customer->notifications()->where('type', 'support-ticket.status-changed')->count());

        $this->actingAs($customer)->postJson("/api/v1/customer/support-tickets/{$ticketId}/replies", [
            'body' => 'The issue is still present.', 'expected_revision' => 7,
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertCreated()->assertJsonPath('data.status', 'open');
        $this->assertSame(1, $customer->notifications()->where('type', 'support-ticket.status-changed')->count());
        $this->assertSame(3, $assignedAdmin->notifications()->where('type', 'support-ticket.requester-replied')->count());
    }

    public function test_requester_reply_falls_back_to_all_eligible_admins_when_assignee_cannot_receive_notifications(): void
    {
        $customer = $this->account(UserRole::Customer);
        $manager = $this->admin('manager@example.com', 'notifications.view', 'support-tickets.view', 'support-tickets.manage');
        $otherAdmin = $this->admin('other@example.com', 'notifications.view', 'support-tickets.view');
        $ineligibleAssignee = $this->admin('no-inbox@example.com', 'support-tickets.view', 'support-tickets.manage');
        $ticketId = $this->actingAs($customer)->postJson('/api/v1/customer/support-tickets', [
            'subject' => 'Delivery issue', 'category' => 'delivery', 'body' => 'Please help.',
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertCreated()->json('data.id');

        $this->actingAs($manager)->postJson("/api/v1/admin/support-tickets/{$ticketId}/claim", [
            'expected_revision' => 1,
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertOk();
        $this->actingAs($manager)->postJson("/api/v1/admin/support-tickets/{$ticketId}/assign", [
            'assignee_id' => $ineligibleAssignee->id,
            'expected_revision' => 3,
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertOk();

        $this->actingAs($customer)->postJson("/api/v1/customer/support-tickets/{$ticketId}/replies", [
            'body' => 'Still waiting for help.', 'expected_revision' => 4,
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertCreated();

        $this->assertSame(1, $manager->notifications()->where('type', 'support-ticket.requester-replied')->count());
        $this->assertSame(1, $otherAdmin->notifications()->where('type', 'support-ticket.requester-replied')->count());
        $this->assertSame(0, $ineligibleAssignee->notifications()->count());
    }

    public function test_delivery_rechecks_admin_permissions_and_requester_account_status(): void
    {
        $customer = $this->account(UserRole::Customer);
        $admin = $this->admin('delivery-check@example.com', 'notifications.view', 'support-tickets.view', 'support-tickets.manage');
        $ticketId = $this->actingAs($customer)->postJson('/api/v1/customer/support-tickets', [
            'subject' => 'Login issue', 'category' => 'account', 'body' => 'Please help.',
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertCreated()->json('data.id');
        $creationEvent = SupportTicketEvent::query()->where('ticket_id', $ticketId)->where('sequence', 1)->firstOrFail();
        $admin->notifications()->where('type', 'support-ticket.created')->delete();
        $this->revokePermission($admin, 'support-tickets.view');

        (new DeliverSupportTicketNotification($ticketId, (string) $creationEvent->id, 'support-ticket.created'))
            ->handle(app(SupportTicketNotificationPresenter::class));
        $this->assertSame(0, $admin->notifications()->where('type', 'support-ticket.created')->count());

        $this->grantPermission($admin, 'support-tickets.view');
        $this->actingAs($admin)->postJson("/api/v1/admin/support-tickets/{$ticketId}/replies", [
            'body' => 'Support has received this.', 'expected_revision' => 1,
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertCreated();
        $replyEvent = SupportTicketEvent::query()->where('ticket_id', $ticketId)->where('sequence', 2)->firstOrFail();
        $customer->notifications()->where('type', 'support-ticket.admin-replied')->delete();
        $customer->update(['status' => UserStatus::Suspended]);

        (new DeliverSupportTicketNotification($ticketId, (string) $replyEvent->id, 'support-ticket.admin-replied'))
            ->handle(app(SupportTicketNotificationPresenter::class));
        $this->assertSame(0, $customer->notifications()->where('type', 'support-ticket.admin-replied')->count());
    }

    public function test_rolled_back_ticket_events_do_not_emit_notifications(): void
    {
        $customer = $this->account(UserRole::Customer);
        $this->admin('rollback@example.com', 'notifications.view', 'support-tickets.view');

        try {
            DB::transaction(function () use ($customer): void {
                $this->actingAs($customer)->postJson('/api/v1/customer/support-tickets', [
                    'subject' => 'Will roll back', 'category' => 'general', 'body' => 'No event should escape.',
                ], ['Idempotency-Key' => (string) Str::uuid()])->assertCreated();
                throw new \RuntimeException('rollback ticket transaction');
            });
        } catch (\RuntimeException $exception) {
            $this->assertSame('rollback ticket transaction', $exception->getMessage());
        }

        $this->assertDatabaseCount('support_tickets', 0);
        $this->assertDatabaseCount('support_ticket_events', 0);
        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_notification_queue_failure_does_not_turn_a_committed_ticket_creation_into_a_failed_response(): void
    {
        $customer = $this->account(UserRole::Customer);
        $this->admin('queue-fallback@example.com', 'notifications.view', 'support-tickets.view');
        config(['queue.default' => 'unavailable-for-support-ticket-test']);

        $response = $this->actingAs($customer)->postJson('/api/v1/customer/support-tickets', [
            'subject' => 'Need help', 'category' => 'general', 'body' => 'Please review this issue.',
        ], ['Idempotency-Key' => (string) Str::uuid()]);

        $response->assertCreated();
        $this->assertDatabaseHas('support_tickets', ['id' => $response->json('data.id')]);
        $this->assertDatabaseHas('notifications', ['type' => 'support-ticket.created']);
    }

    private function account(UserRole $role): User
    {
        return User::factory()->create([
            'email' => fake()->unique()->safeEmail(),
            'role' => $role,
            'status' => UserStatus::Active,
        ]);
    }

    private function admin(string $email, string ...$permissions): User
    {
        $admin = User::factory()->create([
            'email' => $email,
            'role' => UserRole::Admin,
            'status' => UserStatus::Active,
        ]);
        foreach ($permissions as $slug) {
            $permission = Permission::query()->firstOrCreate(['slug' => $slug], ['name' => $slug]);
            AdminPermission::query()->create(['admin_id' => $admin->id, 'permission_id' => $permission->id]);
        }

        return $admin;
    }

    private function grantPermission(User $admin, string $slug): void
    {
        $permission = Permission::query()->firstOrCreate(['slug' => $slug], ['name' => $slug]);
        AdminPermission::query()->firstOrCreate(['admin_id' => $admin->id, 'permission_id' => $permission->id]);
    }

    private function revokePermission(User $admin, string $slug): void
    {
        $permission = Permission::query()->where('slug', $slug)->firstOrFail();
        AdminPermission::query()->where('admin_id', $admin->id)->where('permission_id', $permission->id)->delete();
    }
}
