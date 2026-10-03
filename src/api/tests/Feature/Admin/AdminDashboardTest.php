<?php

namespace Tests\Feature\Admin;

use App\Enums\ApplicationStatus;
use App\Enums\PlatformPolicyType;
use App\Enums\PlatformPolicyVersionStatus;
use App\Enums\SellerComplianceCaseStatus;
use App\Enums\SupportTicketStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AdminPermission;
use App\Models\Permission;
use App\Models\PlatformPolicy;
use App\Models\RegistrationApplication;
use App\Models\SellerComplianceCase;
use App\Models\SupportTicket;
use App\Models\User;
use App\Services\Admin\DashboardQueueCounts;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PDOException;
use Tests\TestCase;

class AdminDashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_denies_guests_and_non_admin_accounts(): void
    {
        $this->getJson('/api/v1/admin/dashboard')->assertUnauthorized();

        $customer = User::factory()->create([
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ]);

        $this->actingAs($customer)
            ->getJson('/api/v1/admin/dashboard')
            ->assertForbidden();
    }

    public function test_dashboard_omits_registration_data_without_view_permission(): void
    {
        $admin = $this->admin();
        $registration = $this->application(
            UserRole::Customer,
            ApplicationStatus::Pending,
            now()->subDay(),
            'hidden-applicant@example.com',
        );

        $response = $this->actingAs($admin)
            ->getJson('/api/v1/admin/dashboard')
            ->assertOk()
            ->assertJsonPath('data.registrations', null)
            ->assertJsonStructure(['data' => ['generated_at']]);

        $this->assertStringNotContainsString(
            $registration->id,
            json_encode($response->json(), JSON_THROW_ON_ERROR),
        );
    }

    public function test_dashboard_returns_pending_registration_kpi_and_bounded_oldest_first_actions(): void
    {
        $admin = $this->adminWithPermission('registrations.view');

        $pending = [
            $this->application(UserRole::Customer, ApplicationStatus::Pending, now()->subDays(7), 'private-one@example.com'),
            $this->application(UserRole::Seller, ApplicationStatus::Pending, now()->subDays(6)),
            $this->application(UserRole::Customer, ApplicationStatus::Pending, now()->subDays(5)),
            $this->application(UserRole::Seller, ApplicationStatus::Pending, now()->subDays(4)),
            $this->application(UserRole::Customer, ApplicationStatus::Pending, now()->subDays(3)),
            $this->application(UserRole::Seller, ApplicationStatus::Pending, now()->subDays(2)),
        ];

        $approved = $this->application(UserRole::Customer, ApplicationStatus::Approved, now()->subDays(9));
        $rejected = $this->application(UserRole::Seller, ApplicationStatus::Rejected, now()->subDays(8));
        $courier = $this->application(UserRole::Courier, ApplicationStatus::Pending, now()->subDays(10));

        $response = $this->actingAs($admin)
            ->getJson('/api/v1/admin/dashboard')
            ->assertOk()
            ->assertJsonPath('data.registrations.pending.total', 6)
            ->assertJsonPath('data.registrations.pending.by_role.customer', 3)
            ->assertJsonPath('data.registrations.pending.by_role.seller', 3)
            ->assertJsonCount(5, 'data.registrations.action_items')
            ->assertJsonPath('data.registrations.action_items.0.id', $pending[0]->id)
            ->assertJsonPath('data.registrations.action_items.1.id', $pending[1]->id)
            ->assertJsonPath('data.registrations.action_items.4.id', $pending[4]->id)
            ->assertJsonStructure([
                'data' => [
                    'registrations' => [
                        'pending' => ['total', 'by_role' => ['customer', 'seller']],
                        'action_items' => [['id', 'role', 'submitted_at']],
                    ],
                    'generated_at',
                ],
            ]);

        $encoded = json_encode($response->json(), JSON_THROW_ON_ERROR);

        $this->assertStringNotContainsString('private-one@example.com', $encoded);
        $this->assertStringNotContainsString('09171234567', $encoded);
        $this->assertStringNotContainsString($pending[5]->id, $encoded);
        $this->assertStringNotContainsString($approved->id, $encoded);
        $this->assertStringNotContainsString($rejected->id, $encoded);
        $this->assertStringNotContainsString($courier->id, $encoded);
        $this->assertDatabaseCount('registration_applications', 9);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_every_permission_combination_omits_unauthorized_sections_before_querying(): void
    {
        $permissions = ['registrations.view', 'support-tickets.view', 'seller_compliance.manage'];
        for ($mask = 0; $mask < 8; $mask++) {
            $admin = $this->admin();
            foreach ($permissions as $index => $permission) {
                if ($mask & (1 << $index)) {
                    $this->grant($admin, $permission);
                }
            }
            $counts = $this->mock(DashboardQueueCounts::class);
            $counts->shouldReceive('openSupportTickets')->times(($mask & 2) ? 1 : 0)->andReturn(0);
            $counts->shouldReceive('openComplianceCases')->times(($mask & 4) ? 1 : 0)->andReturn(0);
            $response = $this->actingAs($admin)->getJson('/api/v1/admin/dashboard')
                ->assertOk()->assertHeader('Cache-Control', 'no-store, private');
            $this->assertSame((bool) ($mask & 1), $response->json('data.registrations') !== null);
            foreach (['support_tickets' => 2, 'seller_compliance' => 4] as $section => $bit) {
                if ($mask & $bit) {
                    $response->assertJsonPath("data.{$section}.state", 'ready')->assertJsonPath("data.{$section}.count", 0);
                } else {
                    $response->assertJsonPath("data.{$section}", null);
                }
            }
            $this->app->forgetInstance(DashboardQueueCounts::class);
        }
    }

    public function test_exact_open_counts_match_queue_filters_without_exposing_or_mutating_records(): void
    {
        $admin = $this->adminWithPermission('support-tickets.view');
        $this->grant($admin, 'seller_compliance.manage');
        $otherAdmin = $this->admin();
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $seller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
        foreach ([null, $admin->id, $otherAdmin->id] as $assignee) {
            $this->ticket($customer, SupportTicketStatus::Open, $assignee);
        }
        foreach ([SupportTicketStatus::InProgress, SupportTicketStatus::WaitingForRequester, SupportTicketStatus::Resolved] as $status) {
            $this->ticket($customer, $status);
        }
        foreach (SellerComplianceCaseStatus::cases() as $status) {
            SellerComplianceCase::create([
                'seller_id' => $seller->id, 'created_by_admin_id' => $admin->id,
                'source_type' => 'manual_admin_review', 'reason' => 'Private compliance reason', 'status' => $status,
            ]);
        }
        $before = SupportTicket::query()->get()->toArray();
        $cases = SellerComplianceCase::query()->get()->toArray();
        $response = $this->actingAs($admin)->getJson('/api/v1/admin/dashboard')->assertOk()
            ->assertJsonPath('data.registrations', null)
            ->assertJsonPath('data.support_tickets', ['state' => 'ready', 'count' => 3, 'filter' => ['status' => 'open'], 'destination' => '/support-tickets?status=open'])
            ->assertJsonPath('data.seller_compliance', ['state' => 'ready', 'count' => 1, 'filter' => ['status' => 'open'], 'destination' => '/seller-compliance?status=open']);
        $this->getJson('/api/v1/admin/support-tickets?status=open&assignee=all')->assertOk()->assertJsonCount(3, 'items');
        $this->getJson('/api/v1/admin/seller-compliance/cases?status=open')->assertOk()->assertJsonPath('meta.total', 1);
        $this->assertSame($before, SupportTicket::query()->get()->toArray());
        $this->assertSame($cases, SellerComplianceCase::query()->get()->toArray());
        foreach (['support_ticket_read_markers', 'support_ticket_events', 'support_ticket_idempotency_receipts', 'seller_compliance_actions', 'notifications', 'audit_logs', 'audit_outbox'] as $table) {
            $this->assertDatabaseCount($table, 0);
        }
        foreach (['Private support subject', 'Private compliance reason', $customer->email, $seller->id, $otherAdmin->id] as $private) {
            $this->assertStringNotContainsString($private, $response->getContent());
        }
    }

    public function test_local_query_failure_is_unavailable_not_zero_and_preserves_other_sections(): void
    {
        $admin = $this->adminWithPermission('registrations.view');
        $this->grant($admin, 'support-tickets.view');
        $this->grant($admin, 'seller_compliance.manage');
        $this->application(UserRole::Logistics, ApplicationStatus::Pending, now());
        $counts = $this->mock(DashboardQueueCounts::class);
        // Execute real invalid SQL, exercising PostgreSQL savepoint recovery too.
        $counts->shouldReceive('openSupportTickets')->once()->andReturnUsing(fn () => DB::table('dashboard_missing_support_fixture')->count());
        $counts->shouldReceive('openComplianceCases')->once()->andReturnUsing(fn () => SellerComplianceCase::query()->count());
        $this->actingAs($admin)->getJson('/api/v1/admin/dashboard')->assertOk()
            ->assertJsonPath('data.registrations.pending.total', 1)
            ->assertJsonPath('data.registrations.pending.by_role.logistics', 1)
            ->assertJsonPath('data.support_tickets.state', 'unavailable')
            ->assertJsonPath('data.support_tickets.count', null)
            ->assertJsonPath('data.support_tickets.destination', '/support-tickets?status=open')
            ->assertJsonPath('data.seller_compliance.state', 'ready')->assertJsonPath('data.seller_compliance.count', 0);
    }

    public function test_shared_connection_or_database_authorization_failure_fails_closed(): void
    {
        $admin = $this->adminWithPermission('support-tickets.view');
        foreach (['08006', '42501'] as $state) {
            $cause = new PDOException('Infrastructure unavailable');
            $cause->errorInfo = [$state, 7, 'Infrastructure unavailable'];
            $exception = new QueryException('pgsql', 'select count(*) from support_tickets', [], $cause);
            $this->mock(DashboardQueueCounts::class)->shouldReceive('openSupportTickets')->once()->andThrow($exception);
            $this->actingAs($admin)->getJson('/api/v1/admin/dashboard')->assertStatus(500)->assertJsonMissingPath('data.support_tickets');
            $this->app->forgetInstance(DashboardQueueCounts::class);
        }
    }

    public function test_compliance_failure_preserves_a_ready_support_count(): void
    {
        $admin = $this->adminWithPermission('support-tickets.view');
        $this->grant($admin, 'seller_compliance.manage');
        $counts = $this->mock(DashboardQueueCounts::class);
        $counts->shouldReceive('openSupportTickets')->once()->andReturn(0);
        $counts->shouldReceive('openComplianceCases')->once()->andReturnUsing(
            fn () => DB::table('seller_compliance_cases')->whereRaw('dashboard_missing_column = 1')->count(),
        );
        $this->actingAs($admin)->getJson('/api/v1/admin/dashboard')->assertOk()
            ->assertJsonPath('data.support_tickets.state', 'ready')->assertJsonPath('data.support_tickets.count', 0)
            ->assertJsonPath('data.seller_compliance.state', 'unavailable')->assertJsonPath('data.seller_compliance.count', null);
    }

    public function test_permission_revocation_inactive_account_and_consent_cannot_reuse_private_sections(): void
    {
        $admin = $this->adminWithPermission('support-tickets.view');
        $this->actingAs($admin)->getJson('/api/v1/admin/dashboard')->assertOk()->assertJsonPath('data.support_tickets.count', 0);
        $admin->permissions()->detach();
        $this->getJson('/api/v1/admin/dashboard')->assertOk()->assertJsonPath('data.support_tickets', null);
        $admin->update(['status' => UserStatus::Suspended]);
        $this->getJson('/api/v1/admin/dashboard')->assertForbidden();
        $admin->update(['status' => UserStatus::Active]);
        $policy = PlatformPolicy::create(['type' => PlatformPolicyType::TermsOfService]);
        $version = $policy->versions()->create([
            'version' => 1, 'title' => 'Terms', 'content' => 'Terms requiring consent',
            'status' => PlatformPolicyVersionStatus::Published, 'requires_reconsent' => false,
            'revision' => 1, 'created_by_admin_id' => $admin->id, 'published_by_admin_id' => $admin->id, 'published_at' => now(),
        ]);
        $policy->update(['current_version_id' => $version->id]);
        $this->getJson('/api/v1/admin/dashboard')->assertForbidden()->assertJsonPath('code', 'POLICY_CONSENT_REQUIRED');
    }

    public function test_registration_actions_break_submission_ties_by_uuid(): void
    {
        $admin = $this->adminWithPermission('registrations.view');
        $submitted = now()->subDay();
        $first = $this->application(UserRole::Logistics, ApplicationStatus::Pending, $submitted);
        $second = $this->application(UserRole::Customer, ApplicationStatus::Pending, $submitted);
        $expected = [$first->id, $second->id];
        sort($expected);
        $this->actingAs($admin)->getJson('/api/v1/admin/dashboard')->assertOk()
            ->assertJsonPath('data.registrations.action_items.0.id', $expected[0])
            ->assertJsonPath('data.registrations.action_items.1.id', $expected[1]);
    }

    private function ticket(User $customer, SupportTicketStatus $status, ?string $assignee = null): void
    {
        SupportTicket::create([
            'reference' => 'SUP-'.Str::uuid(), 'requester_user_id' => $customer->id, 'requester_role' => UserRole::Customer,
            'assignee_user_id' => $assignee, 'subject' => 'Private support subject', 'category' => 'general',
            'status' => $status, 'revision' => 1, 'last_sequence' => 0, 'last_activity_at' => now(),
        ]);
    }

    private function grant(User $admin, string $slug): void
    {
        $permission = Permission::query()->firstOrCreate(['slug' => $slug], ['name' => $slug]);
        AdminPermission::create(['admin_id' => $admin->id, 'permission_id' => $permission->id]);
    }

    private function admin(): User
    {
        $admin = User::factory()->create([
            'role' => UserRole::Admin,
            'status' => UserStatus::Active,
        ]);
        $admin->adminProfile()->create([
            'first_name' => 'Avery',
            'last_name' => 'Admin',
        ]);

        return $admin;
    }

    private function adminWithPermission(string $slug): User
    {
        $admin = $this->admin();
        $permission = Permission::query()->firstOrCreate(
            ['slug' => $slug],
            ['name' => $slug],
        );

        AdminPermission::create([
            'admin_id' => $admin->id,
            'permission_id' => $permission->id,
        ]);

        return $admin;
    }

    private function application(
        UserRole $role,
        ApplicationStatus $status,
        mixed $submittedAt,
        ?string $email = null,
    ): RegistrationApplication {
        $user = User::factory()->create([
            'email' => $email ?? fake()->unique()->safeEmail(),
            'role' => $role,
            'status' => $status === ApplicationStatus::Approved
                ? UserStatus::Active
                : UserStatus::Pending,
        ]);

        return RegistrationApplication::create([
            'user_id' => $user->id,
            'application_type' => $role,
            'status' => $status,
            'submitted_at' => $submittedAt,
        ]);
    }
}
