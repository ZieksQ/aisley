<?php

namespace Tests\Feature\Admin;

use App\Enums\AccountLifecycleAction;
use App\Enums\AdminAuditAction;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AdminPermission;
use App\Models\Permission;
use App\Models\User;
use Database\Seeders\AdminPermissionSeeder;
use Database\Seeders\InitialAdminSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class UserAccountManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_non_admin_and_admin_without_permission_are_denied(): void
    {
        $this->getJson('/api/v1/admin/users')->assertUnauthorized();

        $customer = $this->customer();
        $this->actingAs($customer)->getJson('/api/v1/admin/users')->assertForbidden();

        $admin = $this->adminWithPermissions();
        $this->actingAs($admin)->getJson('/api/v1/admin/users')->assertForbidden();
    }

    public function test_list_is_paginated_filterable_searchable_and_excludes_admins(): void
    {
        $admin = $this->adminWithPermissions('users.view');
        $customer = $this->customer('shared@example.com', 'Mina', 'Buyer');
        $seller = $this->seller('shared@example.com', 'Selena', 'Merchant');
        $this->customer('other@example.com', 'Other', 'Person', UserStatus::Suspended);

        $this->actingAs($admin)
            ->getJson('/api/v1/admin/users?search=selena&role=seller&status=active&sort=newest&per_page=10')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $seller->id)
            ->assertJsonPath('data.0.display_name', 'Selena Merchant')
            ->assertJsonPath('data.0.email', 'shared@example.com')
            ->assertJsonPath('data.0.role', 'seller')
            ->assertJsonMissing(['id' => $customer->id])
            ->assertJsonMissing(['id' => $admin->id])
            ->assertJsonPath('meta.total', 1);

        $this->actingAs($admin)
            ->getJson('/api/v1/admin/users?role=admin')
            ->assertUnprocessable();
    }

    public function test_detail_is_role_aware_and_omits_secrets_and_private_evidence(): void
    {
        $admin = $this->adminWithPermissions('users.view');
        $customer = $this->customer('customer@example.com', 'Casey', 'Customer');
        $customer->registrationApplications()->create([
            'application_type' => UserRole::Customer,
            'status' => 'approved',
            'submitted_at' => now()->subDay(),
            'reviewed_at' => now(),
        ]);

        $response = $this->actingAs($admin)
            ->getJson("/api/v1/admin/users/{$customer->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $customer->id)
            ->assertJsonPath('data.profile.first_name', 'Casey')
            ->assertJsonPath('data.profile.contact_number', '•••••••4567')
            ->assertJsonPath('data.registration.status', 'approved');

        $encoded = json_encode($response->json(), JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString('password', $encoded);
        $this->assertStringNotContainsString('remember_token', $encoded);
        $this->assertStringNotContainsString('document', $encoded);
    }

    public function test_view_permission_does_not_allow_lifecycle_mutation(): void
    {
        $admin = $this->adminWithPermissions('users.view');
        $customer = $this->customer();

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/users/{$customer->id}/suspend", [
                'expected_status' => 'active',
                'reason' => 'Policy review is required.',
            ])
            ->assertForbidden();
    }

    public function test_admin_can_suspend_restore_and_deactivate_with_durable_history_and_audit(): void
    {
        $admin = $this->adminWithPermissions('users.view', 'users.manage');
        $customer = $this->customer();

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/users/{$customer->id}/suspend", [
                'expected_status' => 'active',
                'reason' => 'Repeated marketplace policy violations.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'suspended');

        $this->assertSame(UserStatus::Suspended, $customer->fresh()->status);
        $this->assertDatabaseHas('account_lifecycle_events', [
            'user_id' => $customer->id,
            'action' => AccountLifecycleAction::Suspended->value,
            'previous_status' => UserStatus::Active->value,
            'new_status' => UserStatus::Suspended->value,
            'acted_by_admin_id' => $admin->id,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'actor_id' => $admin->id,
            'action' => AdminAuditAction::UserAccountSuspended->value,
        ]);

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/users/{$customer->id}/restore", [
                'expected_status' => 'suspended',
                'reason' => 'The review was completed successfully.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'active');

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/users/{$customer->id}/deactivate", [
                'expected_status' => 'active',
                'reason' => 'Account closure was confirmed.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'deactivated');

        $this->actingAs($admin)
            ->getJson("/api/v1/admin/users/{$customer->id}/history")
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('data.0.action', 'deactivated')
            ->assertJsonPath('data.1.action', 'restored')
            ->assertJsonPath('data.2.action', 'suspended')
            ->assertJsonPath('data.2.reason', 'Repeated marketplace policy violations.');

        $this->assertDatabaseCount('users', 2);
    }

    public function test_same_email_account_under_another_role_is_not_changed(): void
    {
        $admin = $this->adminWithPermissions('users.manage');
        $customer = $this->customer('same@example.com');
        $seller = $this->seller('same@example.com');

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/users/{$seller->id}/suspend", [
                'expected_status' => 'active',
                'reason' => 'Seller-specific policy review.',
            ])
            ->assertOk();

        $this->assertSame(UserStatus::Active, $customer->fresh()->status);
        $this->assertSame(UserStatus::Suspended, $seller->fresh()->status);
    }

    public function test_invalid_and_stale_transitions_conflict_without_duplicate_history(): void
    {
        $admin = $this->adminWithPermissions('users.manage');
        $customer = $this->customer();

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/users/{$customer->id}/suspend", [
                'expected_status' => 'suspended',
                'reason' => 'Stale request should fail.',
            ])
            ->assertConflict();

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/users/{$customer->id}/restore", [
                'expected_status' => 'active',
                'reason' => 'Invalid transition should fail.',
            ])
            ->assertConflict();

        $this->assertDatabaseCount('account_lifecycle_events', 0);
        $this->assertSame(UserStatus::Active, $customer->fresh()->status);
    }

    public function test_pending_rejected_and_admin_accounts_are_not_lifecycle_targets(): void
    {
        $actor = $this->adminWithPermissions('users.manage');
        $otherAdmin = $this->adminWithPermissions();
        $pending = $this->customer(status: UserStatus::Pending);

        $this->actingAs($actor)
            ->postJson("/api/v1/admin/users/{$pending->id}/suspend", [
                'expected_status' => 'pending',
                'reason' => 'Registration is still pending.',
            ])
            ->assertConflict();

        $this->actingAs($actor)
            ->postJson("/api/v1/admin/users/{$otherAdmin->id}/deactivate", [
                'expected_status' => 'active',
                'reason' => 'Admin accounts are not managed here.',
            ])
            ->assertNotFound();
    }

    public function test_suspended_or_deactivated_user_is_denied_on_the_next_protected_request(): void
    {
        $admin = $this->adminWithPermissions('users.manage');
        $customer = $this->customer();

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/users/{$customer->id}/suspend", [
                'expected_status' => 'active',
                'reason' => 'Immediate access restriction test.',
            ])
            ->assertOk();

        Sanctum::actingAs($customer->fresh(), ['customer']);
        $this->getJson('/api/v1/customer/auth/me')->assertForbidden();
    }

    public function test_lifecycle_request_rejects_direct_status_role_and_missing_reason(): void
    {
        $admin = $this->adminWithPermissions('users.manage');
        $customer = $this->customer();

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/users/{$customer->id}/suspend", [
                'expected_status' => 'active',
                'status' => 'suspended',
                'role' => 'admin',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['reason', 'status', 'role']);
    }

    public function test_seeders_define_and_grant_user_account_permissions(): void
    {
        config()->set('admin.initial.email', 'admin@test.com');
        config()->set('admin.initial.password', 'Admin12345');
        $this->seed(AdminPermissionSeeder::class);
        $this->seed(InitialAdminSeeder::class);

        $admin = User::query()->where('email', 'admin@test.com')->where('role', UserRole::Admin)->firstOrFail();
        $this->assertTrue($admin->permissions()->where('slug', 'users.view')->exists());
        $this->assertTrue($admin->permissions()->where('slug', 'users.manage')->exists());
    }

    private function adminWithPermissions(string ...$slugs): User
    {
        $admin = User::factory()->create([
            'role' => UserRole::Admin,
            'status' => UserStatus::Active,
        ]);

        foreach ($slugs as $slug) {
            $permission = Permission::query()->firstOrCreate(
                ['slug' => $slug],
                ['name' => Str::headline($slug), 'description' => 'Test permission.'],
            );
            AdminPermission::create([
                'admin_id' => $admin->id,
                'permission_id' => $permission->id,
            ]);
        }

        return $admin;
    }

    private function customer(
        string $email = 'customer@example.com',
        string $firstName = 'Customer',
        string $lastName = 'Account',
        UserStatus $status = UserStatus::Active,
    ): User {
        $user = User::factory()->create([
            'email' => $email,
            'role' => UserRole::Customer,
            'status' => $status,
        ]);
        $user->customerProfile()->create([
            'first_name' => $firstName,
            'last_name' => $lastName,
            'contact_number' => '09171234567',
            'sex' => 'prefer_not_to_say',
            'birth_date' => '1995-01-01',
        ]);

        return $user;
    }

    private function seller(
        string $email = 'seller@example.com',
        string $firstName = 'Seller',
        string $lastName = 'Account',
    ): User {
        $user = User::factory()->create([
            'email' => $email,
            'role' => UserRole::Seller,
            'status' => UserStatus::Active,
        ]);
        $user->sellerProfile()->create([
            'first_name' => $firstName,
            'last_name' => $lastName,
            'contact_number' => '09179876543',
            'sex' => 'prefer_not_to_say',
            'birth_date' => '1990-01-01',
        ]);

        return $user;
    }
}
