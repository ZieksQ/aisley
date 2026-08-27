<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AdminProfile;
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

        $this->fromAdminSpa()->postJson('/api/v1/admin/auth/login', [
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

        $this->postJson('/api/v1/admin/auth/logout')
            ->assertOk()
            ->assertJsonPath('message', 'Signed out successfully.');

        $this->assertGuest('web');
        $this->getJson('/api/v1/admin/auth/me')->assertUnauthorized();
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

    public function test_initial_admin_seeder_uses_configured_credentials_without_resetting_an_existing_password(): void
    {
        config()->set('admin.initial', [
            'email' => 'owner@example.com',
            'password' => 'initial-secret',
            'first_name' => 'Initial',
            'last_name' => 'Owner',
        ]);

        $this->seed(InitialAdminSeeder::class);

        $admin = User::query()
            ->where('email', 'owner@example.com')
            ->where('role', UserRole::Admin)
            ->firstOrFail();

        $this->assertSame(UserStatus::Active, $admin->status);
        $this->assertTrue(Hash::check('initial-secret', $admin->password));
        $this->assertSame('Initial', $admin->adminProfile->first_name);

        config()->set('admin.initial.password', 'replacement-secret');
        $this->seed(InitialAdminSeeder::class);

        $this->assertTrue(Hash::check('initial-secret', $admin->fresh()->password));
        $this->assertDatabaseCount('users', 1);
    }

    private function fromAdminSpa(): self
    {
        return $this->withHeader('Origin', 'http://localhost:5175');
    }
}
