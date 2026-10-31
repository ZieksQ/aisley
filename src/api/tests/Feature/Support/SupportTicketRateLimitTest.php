<?php

namespace Tests\Feature\Support;

use App\Enums\CourierAffiliationStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AdminPermission;
use App\Models\Permission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\CreatesOperationalMessagingContext;
use Tests\TestCase;

class SupportTicketRateLimitTest extends TestCase
{
    use CreatesOperationalMessagingContext;
    use RefreshDatabase;

    public static function requesterRoles(): array
    {
        return array_map(fn (UserRole $role) => [$role], [
            'customer' => UserRole::Customer,
            'seller' => UserRole::Seller,
            'logistics' => UserRole::Logistics,
            'courier' => UserRole::Courier,
        ]);
    }

    public static function replyingRoles(): array
    {
        return [...self::requesterRoles(), 'admin' => [UserRole::Admin]];
    }

    public function test_first_submission_after_browsing_succeeds_and_exact_retry_is_idempotent(): void
    {
        $this->actingAs($this->account(UserRole::Customer));
        for ($request = 0; $request < 20; $request++) {
            $this->getJson('/api/v1/customer/shops')->assertOk();
            $this->getJson('/api/v1/customer/support-tickets')->assertOk();
        }

        $key = (string) Str::uuid();
        $first = $this->createTicket('customer', $key)->assertCreated();
        $this->createTicket('customer', $key)->assertCreated()
            ->assertJsonPath('data.id', $first->json('data.id'));
        $this->assertDatabaseCount('support_tickets', 1);
        $this->assertDatabaseCount('support_ticket_events', 1);
    }

    #[DataProvider('requesterRoles')]
    public function test_creation_budget_is_independent_of_replies_reads_and_other_users(UserRole $role): void
    {
        $actor = $this->account($role);
        $base = '/api/v1/'.$role->value.'/support-tickets';
        $this->actingAs($actor);
        for ($attempt = 0; $attempt < 10; $attempt++) {
            $ticket = $this->createTicket($role->value)->assertCreated()->json('data.id');
        }
        $this->assertThrottled($this->createTicket($role->value), 10);
        $this->assertDatabaseCount('support_tickets', 10);

        $this->getJson($base)->assertOk();
        $this->getJson("{$base}/{$ticket}")->assertOk();
        $this->postJson("{$base}/{$ticket}/read", ['last_read_sequence' => 1])->assertOk();
        $this->reply($base, $ticket, 1)->assertCreated();

        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.20']);
        $this->assertThrottled($this->createTicket($role->value), 10);
        $this->withServerVariables(['REMOTE_ADDR' => '127.0.0.1']);
        $this->actingAs($this->account($role));
        $this->createTicket($role->value)->assertCreated();
        $this->actingAs($actor);

        $this->travel(61)->seconds();
        $this->createTicket($role->value)->assertCreated();
        $this->assertDatabaseCount('support_tickets', 12);
    }

    #[DataProvider('replyingRoles')]
    public function test_reply_budget_survives_polling_and_is_shared_across_tickets(UserRole $role): void
    {
        $requester = $this->account($role === UserRole::Admin ? UserRole::Customer : $role);
        $this->actingAs($requester);
        $first = $this->createTicket($requester->role->value)->assertCreated()->json('data.id');
        $second = $this->createTicket($requester->role->value)->assertCreated()->json('data.id');
        $actor = $role === UserRole::Admin ? $this->account($role) : $requester;
        $this->actingAs($actor);
        $base = '/api/v1/'.$role->value.'/support-tickets';
        for ($poll = 0; $poll < 12; $poll++) {
            $this->getJson($base)->assertOk();
            $this->getJson("{$base}/{$first}")->assertOk();
            $this->postJson("{$base}/{$first}/read", ['last_read_sequence' => 1])->assertOk();
        }

        for ($revision = 1; $revision <= 30; $revision++) {
            $this->reply($base, $first, $revision)->assertCreated();
        }
        $this->assertThrottled($this->reply($base, $second, 1), 30);
        $this->assertDatabaseCount('support_ticket_events', 32);
        $this->getJson("{$base}/{$first}")->assertOk();
        $this->postJson("{$base}/{$first}/read", ['last_read_sequence' => 31])->assertOk();
        if ($role !== UserRole::Admin) {
            $this->createTicket($role->value)->assertCreated();
        }

        $other = $this->account($role);
        $this->actingAs($other);
        $otherTicket = $role === UserRole::Admin
            ? $second : $this->createTicket($role->value)->assertCreated()->json('data.id');
        $this->reply($base, $otherTicket, 1)->assertCreated();

        $this->actingAs($actor);
        $this->travel(61)->seconds();
        $this->reply($base, $first, 31)->assertCreated();
    }

    public function test_overall_customer_limit_still_applies(): void
    {
        $this->actingAs($this->account(UserRole::Customer));
        for ($request = 0; $request < 120; $request++) {
            $this->getJson('/api/v1/customer/support-tickets')->assertOk();
        }
        $this->assertThrottled($this->createTicket('customer'), 120);
        $this->assertDatabaseCount('support_tickets', 0);
        $this->travel(61)->seconds();
        $this->createTicket('customer')->assertCreated();
    }

    private function account(UserRole $role): User
    {
        $user = User::factory()->create(['role' => $role, 'status' => UserStatus::Active]);
        if ($role === UserRole::Courier) {
            $organization = $this->logistics()->logisticsOrganization;
            $user->courierLogisticsAffiliation()->create([
                'logistics_organization_id' => $organization->id,
                'logistics_hub_id' => $organization->hub->id,
                'status' => CourierAffiliationStatus::Approved,
            ]);
        }
        if ($role === UserRole::Admin) {
            foreach (['support-tickets.view', 'support-tickets.manage'] as $slug) {
                $permission = Permission::query()->firstOrCreate(['slug' => $slug], ['name' => $slug]);
                AdminPermission::query()->create(['admin_id' => $user->id, 'permission_id' => $permission->id]);
            }
        }

        return $user;
    }

    private function createTicket(string $role, ?string $key = null): TestResponse
    {
        return $this->postJson('/api/v1/'.$role.'/support-tickets', [
            'subject' => 'Account question', 'category' => 'general', 'body' => 'Please help.',
        ], ['Idempotency-Key' => $key ?? (string) Str::uuid()]);
    }

    private function reply(string $base, string $id, int $revision): TestResponse
    {
        return $this->postJson("{$base}/{$id}/replies", [
            'body' => 'More information.', 'expected_revision' => $revision,
        ], ['Idempotency-Key' => (string) Str::uuid()]);
    }

    private function assertThrottled(TestResponse $response, int $limit): void
    {
        $response->assertStatus(429)->assertHeader('X-RateLimit-Limit', (string) $limit)
            ->assertHeader('X-RateLimit-Remaining', '0')->assertHeader('Retry-After');
        $this->assertGreaterThan(0, (int) $response->headers->get('Retry-After'));
    }
}
