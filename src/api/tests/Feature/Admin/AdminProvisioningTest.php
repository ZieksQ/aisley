<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AdminRole;
use App\Models\AdminSetupChallenge;
use App\Models\Permission;
use App\Models\TransactionalEmail;
use App\Models\User;
use App\Services\Mail\TransactionalEmailNotificationFactory;
use Database\Seeders\AdminPermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminProvisioningTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(AdminPermissionSeeder::class);
        $this->withHeader('Origin', 'http://localhost:5175');
    }

    public function test_super_admin_creates_account_with_dependencies_without_exposing_credentials(): void
    {
        $super = $this->admin(true);
        $this->asUser($super)->postJson('/api/v1/admin/admin-accounts', $this->draft())
            ->assertCreated()->assertJsonPath('data.profile.middle_name', 'River')
            ->assertJsonPath('data.setup_required', true)->assertJsonPath('data.permissions.0', 'finance.manage')
            ->assertJsonMissingPath('data.password')->assertJsonMissingPath('data.code_hash');
        $target = User::where('email', 'new.admin@example.com')->firstOrFail();
        $this->assertTrue(Hash::check('Temporary123', $target->password));
        $this->assertNull($target->email_verified_at);
        $this->assertTrue($target->hasAdminPermission('finance.view'));
        $this->assertDatabaseCount('audit_outbox', 1);
    }

    public function test_delegation_and_live_roles_are_authoritative(): void
    {
        $super = $this->admin(true);
        $manager = $this->admin();
        $manager->permissions()->sync(Permission::whereIn('slug', ['admin-accounts.view', 'admin-accounts.create', 'admin-accounts.update', 'finance.view'])->pluck('id'));
        $this->asUser($manager)->postJson('/api/v1/admin/admin-accounts', $this->draft())->assertForbidden();
        $role = $this->asUser($super)->postJson('/api/v1/admin/admin-roles', [
            'name' => 'Finance viewer', 'permissions' => ['finance.view'], 'current_password' => 'Manager123',
        ])->assertCreated()->json('data');
        $target = $this->asUser($manager)->postJson('/api/v1/admin/admin-accounts', $this->draft(['permissions' => [], 'role_ids' => [$role['id']]]))->assertCreated()->json('data');
        $user = User::findOrFail($target['id']);
        $this->assertTrue($user->hasAdminPermission('finance.view'));
        $this->assertTrue(User::withAdminPermission('finance.view')->whereKey($user->id)->exists());
        $this->asUser($super)->patchJson('/api/v1/admin/admin-roles/'.$role['id'], [
            'name' => 'Support', 'permissions' => ['support-tickets.manage'], 'revision' => $role['revision'], 'current_password' => 'Manager123',
        ])->assertOk();
        $this->assertFalse($user->hasAdminPermission('finance.view'));
        $this->assertTrue($user->hasAdminPermission('support-tickets.view'));
        $this->asUser($manager)->patchJson('/api/v1/admin/admin-roles/'.$role['id'], [
            'name' => 'Support', 'permissions' => ['finance.view'], 'revision' => 2, 'current_password' => 'Manager123',
        ])->assertForbidden();
    }

    public function test_role_cannot_modify_own_authority_or_stronger_members_and_assigned_roles_cannot_be_deleted(): void
    {
        $super = $this->admin(true);
        $manager = $this->admin();
        $manager->permissions()->sync(Permission::whereIn('slug', ['admin-accounts.view', 'admin-accounts.create', 'admin-accounts.update', 'admin-accounts.archive', 'finance.view'])->pluck('id'));
        $role = AdminRole::create(['name' => 'Shared']);
        $role->permissions()->sync(Permission::where('slug', 'finance.view')->pluck('id'));
        $role->members()->attach($manager);
        $payload = ['name' => 'Changed', 'permissions' => [], 'revision' => 0, 'current_password' => 'Manager123'];
        $this->asUser($manager)->patchJson('/api/v1/admin/admin-roles/'.$role->id, $payload)->assertForbidden();
        $this->asUser($super)->deleteJson('/api/v1/admin/admin-roles/'.$role->id, ['revision' => 0, 'current_password' => 'Manager123'])->assertConflict();
    }

    public function test_management_permissions_reauthentication_revisions_and_protected_initial_admin(): void
    {
        $super = $this->admin(true);
        $target = $this->admin(true);
        $target->forceFill(['is_initial_admin' => true])->save();
        $this->asUser($super)->postJson('/api/v1/admin/admin-accounts/'.$target->id.'/archive', ['revision' => 0, 'current_password' => 'Manager123'])->assertForbidden();
        $this->postJson('/api/v1/admin/admin-accounts/'.$super->id.'/suspend', ['revision' => 0, 'current_password' => 'Manager123'])->assertForbidden();
        $this->postJson('/api/v1/admin/admin-accounts', $this->draft(['current_password' => 'wrong']))->assertUnprocessable();
        $ordinary = $this->admin();
        $this->postJson('/api/v1/admin/admin-accounts/'.$ordinary->id.'/suspend', ['revision' => 9, 'current_password' => 'Manager123'])->assertConflict();
        $this->postJson('/api/v1/admin/admin-accounts/'.$ordinary->id.'/suspend', ['revision' => 0, 'current_password' => 'Manager123'])->assertOk()->assertJsonPath('data.status', 'suspended');
        $this->postJson('/api/v1/admin/admin-accounts/'.$ordinary->id.'/restore', ['revision' => 1, 'current_password' => 'Manager123'])->assertOk();
        $this->postJson('/api/v1/admin/admin-accounts/'.$ordinary->id.'/archive', ['revision' => 2, 'current_password' => 'Manager123'])->assertOk()->assertJsonPath('data.status', 'deactivated');
        $this->assertDatabaseHas('users', ['id' => $ordinary->id]);
    }

    public function test_first_login_setup_blocks_all_operations_until_atomic_otp_and_password_completion(): void
    {
        $user = $this->pending();
        $this->asUser($user)->getJson('/api/v1/admin/auth/me')->assertOk()->assertJsonPath('admin.setup_required', true);
        $this->getJson('/api/v1/admin/dashboard')->assertForbidden()->assertJsonPath('code', 'ADMIN_SETUP_REQUIRED');
        $this->getJson('/api/v1/admin/account')->assertForbidden();
        $this->getJson('/api/v1/policy-consent/status')->assertForbidden()->assertJsonPath('code', 'ADMIN_SETUP_REQUIRED');
        $challenge = $this->postJson('/api/v1/admin/auth/setup/code', $this->setupData())->assertOk()->json('data');
        $email = TransactionalEmail::query()->latest()->firstOrFail();
        $this->assertNotNull(app(TransactionalEmailNotificationFactory::class)->make($email, $user));
        $this->assertStringNotContainsString($email->payload['code'], DB::table('transactional_emails')->value('payload'));
        $this->postJson('/api/v1/admin/auth/setup/complete', $this->setupData([
            'challenge_id' => $challenge['challenge_id'], 'verification_code' => $email->payload['code'],
        ]))->assertOk()->assertJsonPath('admin.setup_required', false);
        $user->refresh();
        $this->assertTrue(Hash::check('Replacement456', $user->password));
        $this->assertNotNull($user->email_verified_at);
        $this->assertNull(app(TransactionalEmailNotificationFactory::class)->make($email, $user));
        $this->getJson('/api/v1/admin/dashboard')->assertOk();
        $this->assertNotNull(AdminSetupChallenge::find($challenge['challenge_id'])->consumed_at);
    }

    public function test_otp_wrong_attempts_cooldown_expiration_replacement_binding_and_cross_account_safety(): void
    {
        $user = $this->pending();
        $this->asUser($user);
        $challenge = $this->postJson('/api/v1/admin/auth/setup/code', $this->setupData())->assertOk()->json('data');
        $this->postJson('/api/v1/admin/auth/setup/code', $this->setupData())->assertStatus(429)->assertHeader('Retry-After');
        $payload = $this->setupData(['challenge_id' => $challenge['challenge_id'], 'verification_code' => '999999']);
        AdminSetupChallenge::find($challenge['challenge_id'])->update(['code_hash' => Hash::make('123456')]);
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/admin/auth/setup/complete', $payload)->assertUnprocessable();
            $this->travel(61)->seconds();
        }
        $this->assertSame(5, AdminSetupChallenge::find($challenge['challenge_id'])->attempts);
        $this->assertTrue($user->refresh()->admin_setup_required);
        $next = $this->postJson('/api/v1/admin/auth/setup/code', $this->setupData())->assertOk()->json('data');
        $code = TransactionalEmail::latest()->first()->payload['code'];
        $this->postJson('/api/v1/admin/auth/setup/complete', $this->setupData(['password' => 'ChangedAgain789', 'password_confirmation' => 'ChangedAgain789', 'challenge_id' => $next['challenge_id'], 'verification_code' => $code]))->assertUnprocessable();
        $this->assertNotNull(AdminSetupChallenge::find($next['challenge_id'])->invalidated_at);
        $this->travel(61)->seconds();
        $next = $this->postJson('/api/v1/admin/auth/setup/code', $this->setupData())->assertOk()->json('data');
        $other = $this->pending();
        $this->asUser($other)->postJson('/api/v1/admin/auth/setup/complete', $this->setupData(['challenge_id' => $next['challenge_id'], 'verification_code' => '123456']))->assertUnprocessable();
        $this->travel(11)->minutes();
        $this->asUser($user)->postJson('/api/v1/admin/auth/setup/complete', $this->setupData(['challenge_id' => $next['challenge_id'], 'verification_code' => '123456']))->assertUnprocessable();
    }

    public function test_changed_email_requires_only_verification_and_does_not_replace_password(): void
    {
        $user = $this->admin();
        $this->asUser($user)->patchJson('/api/v1/admin/account/email', ['email' => 'changed@example.com', 'current_password' => 'Manager123'])->assertOk()->assertJsonPath('admin.email_verification_required', true);
        $this->getJson('/api/v1/admin/account')->assertForbidden();
        $challenge = $this->postJson('/api/v1/admin/auth/setup/code', ['current_password' => 'Manager123'])->assertOk()->json('data');
        $code = TransactionalEmail::latest()->first()->payload['code'];
        $this->postJson('/api/v1/admin/auth/setup/complete', ['current_password' => 'Manager123', 'challenge_id' => $challenge['challenge_id'], 'verification_code' => $code])->assertOk();
        $this->assertTrue(Hash::check('Manager123', $user->refresh()->password));
    }

    public function test_other_roles_missing_permissions_and_stale_sessions_are_denied(): void
    {
        $this->getJson('/api/v1/admin/admin-accounts')->assertUnauthorized();
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $this->asUser($customer)->getJson('/api/v1/admin/admin-accounts')->assertForbidden();
        $admin = $this->admin();
        $this->asUser($admin)->getJson('/api/v1/admin/admin-accounts')->assertForbidden();
        $admin->forceFill(['admin_session_version' => 1])->save();
        $this->withSession(['admin_session_version' => 0])->getJson('/api/v1/admin/auth/me')->assertUnauthorized();
    }

    public function test_current_session_survives_an_ordinary_password_change(): void
    {
        $user = $this->admin();
        $this->asUser($user)->putJson('/api/v1/admin/account/password', [
            'current_password' => 'Manager123', 'password' => 'Replacement456', 'password_confirmation' => 'Replacement456',
        ])->assertOk();
        $this->getJson('/api/v1/admin/auth/me')->assertOk()->assertJsonPath('admin.id', $user->id);
        $this->assertTrue(Hash::check('Replacement456', $user->refresh()->password));
    }

    private function asUser(User $user): self
    {
        $this->app['auth']->forgetGuards();
        $this->withSession(['password_hash_web' => $user->password, 'admin_session_version' => $user->admin_session_version]);
        $this->actingAs($user, 'web');

        return $this;
    }

    private function admin(bool $super = false): User
    {
        $user = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active, 'password' => 'Manager123']);
        $user->forceFill(['is_super_admin' => $super])->save();
        $user->adminProfile()->create(['first_name' => 'Admin', 'last_name' => 'Example']);

        return $user->refresh();
    }

    private function pending(): User
    {
        return tap($this->admin(), fn ($user) => $user->forceFill(['password' => 'Temporary123', 'email_verified_at' => null, 'admin_setup_required' => true, 'admin_email_verification_required' => true])->save())->refresh();
    }

    private function draft(array $overrides = []): array
    {
        return array_replace(['email' => 'new.admin@example.com', 'first_name' => 'New', 'middle_name' => 'River', 'last_name' => 'Admin',
            'password' => 'Temporary123', 'password_confirmation' => 'Temporary123', 'current_password' => 'Manager123',
            'permissions' => ['finance.manage'], 'role_ids' => []], $overrides);
    }

    private function setupData(array $overrides = []): array
    {
        return array_replace(['current_password' => 'Temporary123', 'password' => 'Replacement456', 'password_confirmation' => 'Replacement456'], $overrides);
    }
}
