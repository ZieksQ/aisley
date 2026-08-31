<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AdminProfile;
use App\Models\Permission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PlatformSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_platform_settings_require_admin_role_and_explicit_permissions(): void
    {
        $this->getJson('/api/v1/admin/platform-settings/announcements')->assertUnauthorized();
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $this->actingAs($customer)->getJson('/api/v1/admin/platform-settings/announcements')->assertForbidden();

        $admin = $this->admin();
        $this->actingAs($admin)->getJson('/api/v1/admin/platform-settings/announcements')->assertForbidden();
        $this->grant($admin, 'platform-settings.view');
        $this->getJson('/api/v1/admin/platform-settings/announcements')->assertOk();
        $this->postJson('/api/v1/admin/platform-settings/announcements', ['title' => 'Notice', 'body' => 'Body'])->assertForbidden();
    }

    public function test_admin_can_create_edit_publish_and_archive_an_announcement(): void
    {
        $admin = $this->adminWithSettingsPermissions();
        $created = $this->actingAs($admin)->postJson('/api/v1/admin/platform-settings/announcements', [
            'title' => 'Scheduled maintenance', 'body' => 'The marketplace will be unavailable briefly.',
        ])->assertCreated()->assertJsonPath('data.status', 'draft');
        $id = $created->json('data.id');

        $this->getJson('/api/v1/platform/announcements')->assertOk()->assertJsonCount(0, 'data');
        $updated = $this->patchJson("/api/v1/admin/platform-settings/announcements/{$id}", [
            'title' => 'Maintenance notice', 'body' => 'The marketplace will be unavailable for fifteen minutes.',
            'expires_at' => now()->addDay()->toIso8601String(), 'revision' => 1,
        ])->assertOk()->assertJsonPath('data.revision', 2);

        $published = $this->postJson("/api/v1/admin/platform-settings/announcements/{$id}/publish", ['revision' => $updated->json('data.revision')])
            ->assertOk()->assertJsonPath('data.status', 'published');
        $this->getJson('/api/v1/platform/announcements')->assertOk()->assertJsonPath('data.0.title', 'Maintenance notice');

        $this->postJson("/api/v1/admin/platform-settings/announcements/{$id}/archive", ['revision' => $published->json('data.revision')])
            ->assertOk()->assertJsonPath('data.status', 'archived');
        $this->getJson('/api/v1/platform/announcements')->assertOk()->assertJsonCount(0, 'data');

        $this->assertDatabaseHas('audit_logs', ['action' => 'platform_settings.announcement_created']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'platform_settings.announcement_published']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'platform_settings.announcement_archived']);
    }

    public function test_announcement_rejects_unsafe_content_and_stale_mutations(): void
    {
        $admin = $this->adminWithSettingsPermissions();
        $this->actingAs($admin)->postJson('/api/v1/admin/platform-settings/announcements', [
            'title' => 'Unsafe', 'body' => '<script>alert(1)</script>',
        ])->assertUnprocessable()->assertJsonValidationErrors('body');

        $created = $this->postJson('/api/v1/admin/platform-settings/announcements', ['title' => 'Safe', 'body' => 'Plain text'])->assertCreated();
        $id = $created->json('data.id');
        $this->patchJson("/api/v1/admin/platform-settings/announcements/{$id}", [
            'title' => 'Changed', 'body' => 'Plain text', 'revision' => 1,
        ])->assertOk();
        $this->postJson("/api/v1/admin/platform-settings/announcements/{$id}/publish", ['revision' => 1])->assertConflict();
    }

    public function test_policy_publication_preserves_history_and_one_current_version(): void
    {
        $admin = $this->adminWithSettingsPermissions();
        $first = $this->actingAs($admin)->postJson('/api/v1/admin/platform-settings/policies/terms_of_service/versions', [
            'title' => 'Terms of Service', 'content' => 'Version one terms.', 'requires_reconsent' => false,
        ])->assertCreated()->assertJsonPath('data.version', 1);
        $firstId = $first->json('data.id');
        $this->postJson("/api/v1/admin/platform-settings/policy-versions/{$firstId}/publish", ['revision' => 1])
            ->assertOk()->assertJsonPath('data.status', 'published');

        $second = $this->postJson('/api/v1/admin/platform-settings/policies/terms_of_service/versions', [
            'title' => 'Terms of Service', 'content' => 'Version two terms.', 'requires_reconsent' => true,
        ])->assertCreated()->assertJsonPath('data.version', 2);
        $secondId = $second->json('data.id');
        $this->postJson("/api/v1/admin/platform-settings/policy-versions/{$secondId}/publish", ['revision' => 1])
            ->assertOk()->assertJsonPath('data.requires_reconsent', true);

        $this->assertDatabaseHas('platform_policy_versions', ['id' => $firstId, 'status' => 'superseded']);
        $this->assertDatabaseHas('platform_policy_versions', ['id' => $secondId, 'status' => 'published']);
        $this->getJson('/api/v1/platform/policies/terms_of_service')->assertOk()
            ->assertJsonPath('data.version.version', 2)
            ->assertJsonPath('data.version.content', 'Version two terms.')
            ->assertJsonPath('data.version.requires_reconsent', true);
        $this->assertDatabaseHas('audit_logs', ['action' => 'platform_settings.policy_version_published']);
    }

    public function test_published_policy_versions_are_immutable_and_types_are_allow_listed(): void
    {
        $admin = $this->adminWithSettingsPermissions();
        $created = $this->actingAs($admin)->postJson('/api/v1/admin/platform-settings/policies/privacy_policy/versions', [
            'title' => 'Privacy Policy', 'content' => 'We describe data handling here.', 'requires_reconsent' => false,
        ])->assertCreated();
        $id = $created->json('data.id');
        $this->postJson("/api/v1/admin/platform-settings/policy-versions/{$id}/publish", ['revision' => 1])->assertOk();
        $this->patchJson("/api/v1/admin/platform-settings/policy-versions/{$id}", [
            'title' => 'Changed', 'content' => 'Changed in place.', 'requires_reconsent' => false, 'revision' => 2,
        ])->assertConflict();
        $this->postJson('/api/v1/admin/platform-settings/policies/database_credentials/versions', [
            'title' => 'Not allowed', 'content' => 'No.', 'requires_reconsent' => false,
        ])->assertNotFound();
    }

    public function test_editing_current_published_policy_creates_one_copied_successor_draft(): void
    {
        $admin = $this->adminWithSettingsPermissions();
        $published = $this->actingAs($admin)->postJson('/api/v1/admin/platform-settings/policies/terms_of_service/versions', [
            'title' => 'Terms of Service',
            'content' => 'The exact published terms.',
            'change_summary' => 'Initial publication',
            'requires_reconsent' => true,
        ])->assertCreated();
        $publishedId = $published->json('data.id');
        $this->postJson("/api/v1/admin/platform-settings/policy-versions/{$publishedId}/publish", ['revision' => 1])->assertOk();

        $successor = $this->postJson("/api/v1/admin/platform-settings/policy-versions/{$publishedId}/successor", [
            'change_summary' => 'Clarify marketplace responsibilities',
        ])->assertCreated()
            ->assertJsonPath('data.version', 2)
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.title', 'Terms of Service')
            ->assertJsonPath('data.content', 'The exact published terms.')
            ->assertJsonPath('data.requires_reconsent', true)
            ->assertJsonPath('data.source_policy_version_id', $publishedId)
            ->assertJsonPath('data.change_summary', 'Clarify marketplace responsibilities');
        $successorId = $successor->json('data.id');

        $this->postJson("/api/v1/admin/platform-settings/policy-versions/{$publishedId}/successor")
            ->assertOk()
            ->assertJsonPath('data.id', $successorId);

        $this->patchJson("/api/v1/admin/platform-settings/policy-versions/{$successorId}", [
            'title' => 'Updated Terms of Service',
            'content' => 'The successor-only draft content.',
            'change_summary' => 'Clarify marketplace responsibilities',
            'requires_reconsent' => false,
            'revision' => 1,
        ])->assertOk();

        $this->assertDatabaseHas('platform_policy_versions', [
            'id' => $publishedId,
            'title' => 'Terms of Service',
            'content' => 'The exact published terms.',
            'status' => 'published',
            'requires_reconsent' => true,
        ]);
        $this->getJson('/api/v1/platform/policies/terms_of_service')->assertOk()
            ->assertJsonPath('data.version.id', $publishedId)
            ->assertJsonPath('data.version.content', 'The exact published terms.');
        $this->assertDatabaseCount('platform_policy_versions', 2);
        $this->assertDatabaseHas('audit_logs', ['action' => 'platform_settings.policy_successor_created']);
    }

    public function test_public_policy_history_excludes_drafts_and_internal_rules(): void
    {
        $admin = $this->adminWithSettingsPermissions();
        $first = $this->actingAs($admin)->postJson('/api/v1/admin/platform-settings/policies/privacy_policy/versions', [
            'title' => 'Privacy Policy', 'content' => 'Published privacy version one.', 'change_summary' => 'Initial version', 'requires_reconsent' => false,
        ])->assertCreated();
        $firstId = $first->json('data.id');
        $this->postJson("/api/v1/admin/platform-settings/policy-versions/{$firstId}/publish", ['revision' => 1])->assertOk();
        $draft = $this->postJson("/api/v1/admin/platform-settings/policy-versions/{$firstId}/successor", [
            'change_summary' => 'Draft-only changes',
        ])->assertCreated();

        $this->getJson('/api/v1/platform/policies/privacy_policy/history')->assertOk()
            ->assertJsonCount(1, 'data.versions')
            ->assertJsonPath('data.versions.0.id', $firstId)
            ->assertJsonMissing(['id' => $draft->json('data.id')])
            ->assertJsonMissingPath('data.versions.0.content');
        $this->getJson('/api/v1/platform/policies/privacy_policy/history/1')->assertOk()
            ->assertJsonPath('data.version.id', $firstId)
            ->assertJsonPath('data.version.content', 'Published privacy version one.')
            ->assertJsonMissingPath('data.version.revision');
        $this->getJson('/api/v1/platform/policies/privacy_policy/history/2')->assertNotFound();

        $internal = $this->postJson('/api/v1/admin/platform-settings/policies/internal_rules/versions', [
            'title' => 'Internal Rules', 'content' => 'Authorized operators only.', 'requires_reconsent' => false,
        ])->assertCreated();
        $this->postJson('/api/v1/admin/platform-settings/policy-versions/'.$internal->json('data.id').'/publish', ['revision' => 1])->assertOk();
        $this->getJson('/api/v1/platform/policies/internal_rules')->assertNotFound();
        $this->getJson('/api/v1/platform/policies/internal_rules/history')->assertNotFound();
    }

    private function adminWithSettingsPermissions(): User
    {
        $admin = $this->admin();
        $this->grant($admin, 'platform-settings.view');
        $this->grant($admin, 'platform-settings.manage');

        return $admin;
    }

    private function admin(): User
    {
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        AdminProfile::create(['user_id' => $admin->id, 'first_name' => 'Avery', 'last_name' => 'Admin']);

        return $admin;
    }

    private function grant(User $admin, string $slug): void
    {
        $permission = Permission::firstOrCreate(['slug' => $slug], ['name' => str($slug)->headline()]);
        $admin->permissions()->syncWithoutDetaching($permission);
    }
}
