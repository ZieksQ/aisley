<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AdminProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AdminAccountManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('admin-profile-test');
        config()->set('filesystems.default', 'admin-profile-test');
    }

    public function test_only_an_active_admin_can_use_own_account_endpoints(): void
    {
        $this->getJson('/api/v1/admin/account')->assertUnauthorized();

        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $this->actingAs($customer)->getJson('/api/v1/admin/account')->assertForbidden();

        $admin = $this->admin();
        $this->actingAs($admin)->getJson('/api/v1/admin/account')
            ->assertOk()
            ->assertJsonPath('account.id', $admin->id)
            ->assertJsonPath('account.profile.first_name', 'Avery')
            ->assertJsonMissingPath('account.password');
    }

    public function test_admin_can_update_defined_profile_fields_without_changing_role_or_permissions(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)->patchJson('/api/v1/admin/account/profile', [
            'first_name' => 'Alex',
            'last_name' => 'Administrator',
            'middle_name' => 'Quinn',
            'contact_number' => '+639171234567',
            'sex' => 'prefer_not_to_say',
            'birth_date' => '1992-06-15',
        ])->assertOk()
            ->assertJsonPath('account.profile.first_name', 'Alex')
            ->assertJsonPath('admin.profile.first_name', 'Alex');

        $this->assertDatabaseHas('admin_profiles', [
            'user_id' => $admin->id,
            'first_name' => 'Alex',
            'contact_number' => '+639171234567',
        ]);
        $this->assertSame(UserRole::Admin, $admin->fresh()->role);
        $this->assertDatabaseHas('audit_logs', ['action' => 'admin_account.profile_updated']);

        $this->patchJson('/api/v1/admin/account/profile', [
            'first_name' => 'Alex', 'last_name' => 'Administrator', 'role' => 'customer',
        ])->assertUnprocessable()->assertJsonValidationErrors('role');
    }

    public function test_email_and_password_updates_use_current_password_without_two_factor_authentication(): void
    {
        $admin = $this->admin();
        User::factory()->create(['email' => 'shared@example.com', 'role' => UserRole::Customer]);

        $this->actingAs($admin)->patchJson('/api/v1/admin/account/email', [
            'email' => ' SHARED@example.com ',
            'current_password' => 'CurrentAdmin123',
        ])->assertOk()->assertJsonPath('account.email', 'shared@example.com');

        $this->putJson('/api/v1/admin/account/password', [
            'current_password' => 'wrong-password',
            'password' => 'UpdatedAdmin456',
            'password_confirmation' => 'UpdatedAdmin456',
        ])->assertUnprocessable()->assertJsonValidationErrors('current_password');

        $this->putJson('/api/v1/admin/account/password', [
            'current_password' => 'CurrentAdmin123',
            'password' => 'UpdatedAdmin456',
            'password_confirmation' => 'UpdatedAdmin456',
        ])->assertOk()->assertJsonMissingPath('password');

        $this->assertTrue(Hash::check('UpdatedAdmin456', $admin->fresh()->password));
        $this->assertDatabaseHas('audit_logs', ['action' => 'admin_account.email_updated']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'admin_account.password_updated']);
    }

    public function test_admin_can_upload_replace_view_and_remove_a_private_profile_photo(): void
    {
        $admin = $this->admin();

        $first = $this->actingAs($admin)->post('/api/v1/admin/account/profile-photo', [
            'photo' => $this->image('avatar.png'),
        ], ['Accept' => 'application/json'])->assertOk();

        $this->assertStringStartsWith(
            '/api/v1/admin/account/profile-photo?v=',
            (string) $first->json('account.profile.profile_photo_url'),
        );

        $encoded = json_encode($first->json(), JSON_THROW_ON_ERROR);
        $this->assertStringNotContainsString('admin-profile-photos/', $encoded);
        $profile = $admin->adminProfile->fresh();
        Storage::disk('admin-profile-test')->assertExists($profile->profile_photo_path);
        $oldPath = $profile->profile_photo_path;

        $this->get('/api/v1/admin/account/profile-photo')
            ->assertOk()
            ->assertHeader('Content-Type', 'image/png')
            ->assertHeader('X-Content-Type-Options', 'nosniff');

        $this->post('/api/v1/admin/account/profile-photo', [
            'photo' => $this->image('replacement.png'),
        ], ['Accept' => 'application/json'])->assertOk();
        Storage::disk('admin-profile-test')->assertMissing($oldPath);

        $this->deleteJson('/api/v1/admin/account/profile-photo')->assertOk()
            ->assertJsonPath('account.profile.profile_photo_url', null);
        $this->get('/api/v1/admin/account/profile-photo')->assertNotFound();
        $this->assertDatabaseHas('audit_logs', ['action' => 'admin_account.profile_photo_updated']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'admin_account.profile_photo_removed']);
    }

    public function test_profile_photo_rejects_corrupt_files_and_multiple_extensions(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin)->post('/api/v1/admin/account/profile-photo', [
            'photo' => UploadedFile::fake()->createWithContent('avatar.png', 'not-an-image'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('photo');

        $this->post('/api/v1/admin/account/profile-photo', [
            'photo' => $this->image('avatar.safe.png'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('photo');
    }

    private function admin(): User
    {
        $admin = User::factory()->create([
            'email' => 'admin@example.com',
            'password' => 'CurrentAdmin123',
            'role' => UserRole::Admin,
            'status' => UserStatus::Active,
        ]);
        AdminProfile::create([
            'user_id' => $admin->id,
            'first_name' => 'Avery',
            'last_name' => 'Admin',
        ]);

        return $admin;
    }

    private function image(string $name): UploadedFile
    {
        return UploadedFile::fake()->createWithContent(
            $name,
            base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true),
        );
    }
}
