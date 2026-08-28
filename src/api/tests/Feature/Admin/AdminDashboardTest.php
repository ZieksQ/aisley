<?php

namespace Tests\Feature\Admin;

use App\Enums\ApplicationStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AdminPermission;
use App\Models\Permission;
use App\Models\RegistrationApplication;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
