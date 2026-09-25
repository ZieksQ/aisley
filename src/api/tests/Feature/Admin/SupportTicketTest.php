<?php

namespace Tests\Feature\Admin;

use App\Enums\AddressType;
use App\Enums\CourierAffiliationStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AdminPermission;
use App\Models\Permission;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class SupportTicketTest extends TestCase
{
    use RefreshDatabase;

    public function test_requester_can_create_ticket_without_context_and_only_owner_can_read_it(): void
    {
        $this->getJson('/api/v1/customer/support-tickets')->assertUnauthorized();
        $customer = $this->account(UserRole::Customer, 'shared@example.com');
        $seller = $this->account(UserRole::Seller, 'shared@example.com');
        $ticket = $this->createTicket($customer);

        $this->actingAs($customer)->getJson('/api/v1/customer/support-tickets')
            ->assertOk()->assertJsonPath('items.0.id', $ticket);
        $this->actingAs($seller)->getJson("/api/v1/seller/support-tickets/{$ticket}")->assertNotFound();
        $this->actingAs($seller)->getJson('/api/v1/seller/support-tickets')->assertOk()->assertJsonCount(0, 'items');
        $this->getJson('/api/v1/admin/support-tickets')->assertForbidden();

        $this->actingAs($customer)->postJson('/api/v1/customer/support-tickets', [
            'subject' => 'Missing parcel', 'category' => 'delivery', 'body' => 'Please check.',
            'context_type' => 'order', 'context_id' => (string) Str::uuid(),
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertUnprocessable();
        $this->actingAs($customer)->postJson('/api/v1/customer/support-tickets', [
            'subject' => 'Forged', 'category' => 'general', 'body' => 'Please check.',
            'requester_user_id' => $seller->id,
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertUnprocessable();
    }

    public function test_create_and_reply_retries_are_idempotent_and_conflicting_keys_fail(): void
    {
        $customer = $this->account(UserRole::Customer);
        $key = (string) Str::uuid();
        $payload = ['subject' => 'Account question', 'category' => 'account', 'body' => 'Please help.'];
        $first = $this->actingAs($customer)->postJson('/api/v1/customer/support-tickets', $payload, ['Idempotency-Key' => $key])->assertCreated();
        $ticket = $first->json('data.id');
        $this->actingAs($customer)->postJson('/api/v1/customer/support-tickets', $payload, ['Idempotency-Key' => $key])
            ->assertCreated()->assertJsonPath('data.id', $ticket);
        $this->actingAs($customer)->postJson('/api/v1/customer/support-tickets', [...$payload, 'body' => 'Changed.'], ['Idempotency-Key' => $key])->assertConflict();
        $this->assertDatabaseCount('support_tickets', 1);
        $this->assertDatabaseCount('support_ticket_events', 1);

        $replyKey = (string) Str::uuid();
        $reply = ['body' => 'Any update?', 'expected_revision' => 1];
        $this->actingAs($customer)->postJson("/api/v1/customer/support-tickets/{$ticket}/replies", $reply, ['Idempotency-Key' => $replyKey])->assertCreated();
        $this->actingAs($customer)->postJson("/api/v1/customer/support-tickets/{$ticket}/replies", $reply, ['Idempotency-Key' => $replyKey])->assertCreated();
        $this->assertDatabaseCount('support_ticket_events', 2);
        $this->actingAs($customer)->postJson("/api/v1/customer/support-tickets/{$ticket}/replies", $reply, ['Idempotency-Key' => (string) Str::uuid()])->assertConflict();
    }

    public function test_admin_read_markers_are_individual_and_cannot_move_backwards(): void
    {
        $customer = $this->account(UserRole::Customer);
        $ticket = $this->createTicket($customer);
        $firstAdmin = $this->admin('first@example.com');
        $secondAdmin = $this->admin('second@example.com');

        $this->actingAs($firstAdmin)->getJson("/api/v1/admin/support-tickets/{$ticket}")
            ->assertOk()->assertJsonPath('data.unread_count', 1);
        $this->actingAs($firstAdmin)->postJson("/api/v1/admin/support-tickets/{$ticket}/read", ['last_read_sequence' => 1])
            ->assertOk()->assertJsonPath('data.unread_count', 0);
        $this->actingAs($secondAdmin)->getJson("/api/v1/admin/support-tickets/{$ticket}")
            ->assertOk()->assertJsonPath('data.unread_count', 1);
        $this->actingAs($firstAdmin)->postJson("/api/v1/admin/support-tickets/{$ticket}/read", ['last_read_sequence' => 0])
            ->assertOk()->assertJsonPath('data.unread_count', 0);
        $this->assertDatabaseHas('support_ticket_read_markers', [
            'ticket_id' => $ticket, 'user_id' => $firstAdmin->id, 'last_read_sequence' => 1,
        ]);
    }

    public function test_admin_lifecycle_requires_permissions_revision_and_visible_resolution(): void
    {
        $customer = $this->account(UserRole::Customer);
        $ticket = $this->createTicket($customer);
        $viewer = $this->admin('viewer@example.com', false);
        $admin = $this->admin('manager@example.com');

        $this->actingAs($viewer)->getJson("/api/v1/admin/support-tickets/{$ticket}")->assertOk();
        $this->actingAs($viewer)->postJson("/api/v1/admin/support-tickets/{$ticket}/claim", ['expected_revision' => 1], ['Idempotency-Key' => (string) Str::uuid()])->assertForbidden();

        $this->actingAs($admin)->postJson("/api/v1/admin/support-tickets/{$ticket}/claim", ['expected_revision' => 1], ['Idempotency-Key' => (string) Str::uuid()])
            ->assertOk()->assertJsonPath('data.status', 'in_progress');
        $this->actingAs($admin)->postJson("/api/v1/admin/support-tickets/{$ticket}/status", [
            'status' => 'resolved', 'expected_revision' => 1, 'reason' => 'We located it.',
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertConflict();
        $revision = $this->actingAs($admin)->getJson("/api/v1/admin/support-tickets/{$ticket}")->json('data.revision');
        $this->actingAs($admin)->postJson("/api/v1/admin/support-tickets/{$ticket}/status", [
            'status' => 'resolved', 'expected_revision' => $revision,
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertUnprocessable();
        $this->actingAs($admin)->postJson("/api/v1/admin/support-tickets/{$ticket}/status", [
            'status' => 'resolved', 'expected_revision' => $revision, 'reason' => 'We located it.',
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertOk()->assertJsonPath('data.status', 'resolved');
        $revision = $this->actingAs($customer)->getJson("/api/v1/customer/support-tickets/{$ticket}")->json('data.revision');
        $this->actingAs($customer)->postJson("/api/v1/customer/support-tickets/{$ticket}/replies", [
            'body' => 'I still need help.', 'expected_revision' => $revision,
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertCreated()->assertJsonPath('data.status', 'open');
    }

    public function test_assignment_rejects_admin_without_manage_permission(): void
    {
        $customer = $this->account(UserRole::Customer);
        $ticket = $this->createTicket($customer);
        $manager = $this->admin('manager@example.com');
        $viewer = $this->admin('viewer@example.com', false);

        $this->actingAs($manager)->postJson("/api/v1/admin/support-tickets/{$ticket}/assign", [
            'assignee_id' => $viewer->id, 'expected_revision' => 1,
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertUnprocessable();
        $this->actingAs($manager)->getJson('/api/v1/admin/support-tickets/assignees')
            ->assertOk()->assertJsonCount(1, 'items')->assertJsonPath('items.0.id', $manager->id);
    }

    public function test_support_queue_and_event_history_use_bounded_cursors(): void
    {
        $customer = $this->account(UserRole::Customer);
        $first = $this->createTicket($customer);
        $second = $this->createTicket($customer);
        $admin = $this->admin('manager@example.com');

        $firstPage = $this->actingAs($admin)->getJson('/api/v1/admin/support-tickets?limit=1')->assertOk();
        $this->assertCount(1, $firstPage->json('items'));
        $this->assertNotNull($firstPage->json('next_cursor'));
        $secondPage = $this->actingAs($admin)->getJson('/api/v1/admin/support-tickets?limit=1&cursor='.urlencode($firstPage->json('next_cursor')))->assertOk();
        $this->assertNotSame($firstPage->json('items.0.id'), $secondPage->json('items.0.id'));
        $this->assertEqualsCanonicalizing([$first, $second], [$firstPage->json('items.0.id'), $secondPage->json('items.0.id')]);

        $this->actingAs($customer)->postJson("/api/v1/customer/support-tickets/{$first}/replies", [
            'body' => 'Additional information.', 'expected_revision' => 1,
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertCreated();
        $history = $this->actingAs($admin)->getJson("/api/v1/admin/support-tickets/{$first}?limit=1")->assertOk();
        $this->assertCount(1, $history->json('events'));
        $this->assertNotNull($history->json('next_cursor'));
    }

    public function test_event_rows_are_append_only_at_the_database_layer(): void
    {
        $customer = $this->account(UserRole::Customer);
        $ticket = $this->createTicket($customer);
        try {
            DB::table('support_ticket_events')->where('ticket_id', $ticket)->update(['body' => 'overwritten']);
            $this->fail('The event update should have been rejected.');
        } catch (QueryException $exception) {
            $this->assertStringContainsString('append-only', $exception->getMessage());
        }
    }

    public function test_courier_ticket_api_requires_an_approved_active_logistics_affiliation(): void
    {
        $courier = $this->account(UserRole::Courier);
        $this->actingAs($courier)->getJson('/api/v1/courier/support-tickets')->assertForbidden();

        $logistics = $this->account(UserRole::Logistics);
        $address = $logistics->addresses()->create([
            'type' => AddressType::Both,
            'label' => 'Operational hub',
            'recipient_name' => 'Logistics Operator',
            'contact_number' => '09171234567',
            'address_line_1' => '1 Hub Road',
            'barangay' => 'Poblacion',
            'city_municipality' => 'Makati City',
            'province' => 'Metro Manila',
            'region' => 'National Capital Region',
            'postal_code' => '1200',
            'country' => 'Philippines',
            'is_default' => true,
        ]);
        $organization = $logistics->logisticsOrganization()->create(['business_name' => 'Delivery Services']);
        $hub = $organization->hub()->create(['address_id' => $address->id, 'name' => 'Operational hub']);
        $courier->courierLogisticsAffiliation()->create([
            'logistics_organization_id' => $organization->id,
            'logistics_hub_id' => $hub->id,
            'status' => CourierAffiliationStatus::Approved,
        ]);

        $ticket = $this->createTicket($courier);
        $this->actingAs($courier)->getJson("/api/v1/courier/support-tickets/{$ticket}")
            ->assertOk()->assertJsonPath('data.requester_role', 'courier');
    }

    private function createTicket(User $actor): string
    {
        return $this->actingAs($actor)->postJson('/api/v1/'.$actor->role->value.'/support-tickets', [
            'subject' => 'Missing parcel', 'category' => 'delivery', 'body' => 'Please check.',
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertCreated()->json('data.id');
    }

    private function account(UserRole $role, ?string $email = null): User
    {
        return User::factory()->create([
            'email' => $email ?? fake()->unique()->safeEmail(),
            'role' => $role,
            'status' => UserStatus::Active,
        ]);
    }

    private function admin(string $email, bool $manage = true): User
    {
        $admin = $this->account(UserRole::Admin, $email);
        foreach ($manage ? ['support-tickets.view', 'support-tickets.manage'] : ['support-tickets.view'] as $slug) {
            $permission = Permission::query()->firstOrCreate(['slug' => $slug], ['name' => $slug]);
            AdminPermission::query()->create(['admin_id' => $admin->id, 'permission_id' => $permission->id]);
        }

        return $admin;
    }
}
