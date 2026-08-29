<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AdminPermission;
use App\Models\AdminProfile;
use App\Models\Permission;
use App\Models\User;
use Database\Seeders\InitialAdminSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_active_admin_can_sign_in_view_their_session_and_sign_out(): void
    {
        $admin = User::factory()->create([
            'email' => 'admin@example.com',
            'password' => 'correct-password',
            'role' => UserRole::Admin,
            'status' => UserStatus::Active,
        ]);
        AdminProfile::create([
            'user_id' => $admin->id,
            'first_name' => 'Avery',
            'last_name' => 'Admin',
        ]);
        $permission = Permission::create([
            'name' => 'View system audit logs',
            'slug' => 'audit-logs.view',
        ]);
        AdminPermission::create([
            'admin_id' => $admin->id,
            'permission_id' => $permission->id,
        ]);

        $this->fromAdminSpa()->withHeader('User-Agent', 'Admin authentication test')->postJson('/api/v1/admin/auth/login', [
            'email' => 'ADMIN@example.com',
            'password' => 'correct-password',
            'remember' => false,
        ])->assertOk()
            ->assertJsonPath('message', 'Signed in successfully.')
            ->assertJsonPath('admin.id', $admin->id)
            ->assertJsonPath('admin.role', UserRole::Admin->value)
            ->assertJsonPath('admin.status', UserStatus::Active->value)
            ->assertJsonPath('admin.profile.first_name', 'Avery');

        $this->assertAuthenticatedAs($admin);

        $this->getJson('/api/v1/admin/auth/me')
            ->assertOk()
            ->assertJsonPath('admin.email', 'admin@example.com');

        $this->getJson('/api/v1/admin/audit-logs?action=admin.login_succeeded')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.actor.id', $admin->id)
            ->assertJsonPath('data.0.actor.email', 'admin@example.com')
            ->assertJsonPath('data.0.source_feature', 'admin_authentication')
            ->assertJsonPath('data.0.action', 'admin.login_succeeded')
            ->assertJsonPath('data.0.target.type', 'admin_account')
            ->assertJsonPath('data.0.target.id', $admin->id)
            ->assertJsonPath('data.0.target.snapshot.email', 'admin@example.com');

        $this->postJson('/api/v1/admin/auth/logout')
            ->assertOk()
            ->assertJsonPath('message', 'Signed out successfully.');

        $this->assertGuest('web');
        $this->getJson('/api/v1/admin/auth/me')->assertUnauthorized();
        $this->assertDatabaseCount('audit_logs', 1);
    }

    public function test_invalid_credentials_do_not_create_an_admin_session(): void
    {
        User::factory()->create([
            'email' => 'admin@example.com',
            'password' => 'correct-password',
            'role' => UserRole::Admin,
        ]);

        $this->fromAdminSpa()->postJson('/api/v1/admin/auth/login', [
            'email' => 'admin@example.com',
            'password' => 'wrong-password',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        $this->assertGuest();
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_non_admin_credentials_cannot_sign_in_to_the_admin_app(): void
    {
        User::factory()->create([
            'email' => 'shared@example.com',
            'password' => 'customer-password',
            'role' => UserRole::Customer,
        ]);

        $this->fromAdminSpa()->postJson('/api/v1/admin/auth/login', [
            'email' => 'shared@example.com',
            'password' => 'customer-password',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        $this->assertGuest();
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_inactive_admin_cannot_sign_in_or_use_an_existing_session(): void
    {
        $admin = User::factory()->create([
            'email' => 'suspended@example.com',
            'password' => 'correct-password',
            'role' => UserRole::Admin,
            'status' => UserStatus::Suspended,
        ]);

        $this->fromAdminSpa()->postJson('/api/v1/admin/auth/login', [
            'email' => $admin->email,
            'password' => 'correct-password',
        ])->assertForbidden()
            ->assertJsonPath('message', 'Your administrator account is not active.');

        $this->actingAs($admin)
            ->getJson('/api/v1/admin/auth/me')
            ->assertForbidden();
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_authenticated_non_admin_is_blocked_from_admin_routes(): void
    {
        $customer = User::factory()->create([
            'role' => UserRole::Customer,
            'status' => UserStatus::Active,
        ]);

        $this->actingAs($customer)
            ->getJson('/api/v1/admin/auth/me')
            ->assertForbidden()
            ->assertJsonPath('message', 'This area is restricted to administrators.');
    }

    public function test_initial_admin_seeder_uses_configuration_without_overwriting_an_existing_account(): void
    {
        config()->set('admin.initial', [
            'email' => ' BOOTSTRAP.ADMIN@example.com ',
            'password' => 'InitialAdmin123',
            'first_name' => 'Bootstrap',
            'last_name' => 'Administrator',
        ]);

        User::factory()->create([
            'email' => 'bootstrap.admin@example.com',
            'role' => UserRole::Customer,
        ]);

        app(InitialAdminSeeder::class)->run();

        $admin = User::query()
            ->where('email', 'bootstrap.admin@example.com')
            ->where('role', UserRole::Admin)
            ->firstOrFail();

        $this->assertSame(UserStatus::Active, $admin->status);
        $this->assertTrue(Hash::check('InitialAdmin123', $admin->password));
        $this->assertSame('Bootstrap', $admin->adminProfile->first_name);

        $admin->update([
            'password' => 'ChangedAdmin456',
            'status' => UserStatus::Suspended,
        ]);
        config()->set('admin.initial.password', 'ReplacementAdmin789');
        $this->seed(InitialAdminSeeder::class);

        $admin->refresh();
        $this->assertSame(UserStatus::Suspended, $admin->status);
        $this->assertTrue(Hash::check('ChangedAdmin456', $admin->password));
        $this->assertDatabaseCount('users', 2);
    }

    public function test_initial_admin_seeder_requires_explicit_credentials_in_production(): void
    {
        $this->app->detectEnvironment(fn () => 'production');
        config()->set('admin.initial', [
            'email' => null,
            'password' => null,
            'first_name' => 'Platform',
            'last_name' => 'Administrator',
        ]);

        app(InitialAdminSeeder::class)->run();

        $this->assertDatabaseMissing('users', [
            'role' => UserRole::Admin->value,
        ]);

        config()->set('admin.initial', [
            'email' => 'production-admin@example.com',
            'password' => 'ProductionAdmin123',
            'first_name' => 'Production',
            'last_name' => 'Administrator',
        ]);
        app(InitialAdminSeeder::class)->run();

        $this->assertDatabaseHas('users', [
            'email' => 'production-admin@example.com',
            'role' => UserRole::Admin->value,
        ]);
    }

    private function fromAdminSpa(): self
    {
        return $this->withHeader('Origin', 'http://localhost:5175');
    }
}
