<?php

namespace Tests\Feature\Shared;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AdminProfile;
use App\Models\Permission;
use App\Models\PlatformPolicy;
use App\Models\User;
use App\Http\Middleware\Policy\EnsurePolicyConsent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class PolicyViewingTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_policy_views_are_cacheable_and_expose_only_published_safe_content(): void
    {
        $admin = $this->adminWithSettingsPermissions();
        $first = $this->actingAs($admin)->postJson('/api/v1/admin/platform-settings/policies/terms_of_service/versions', [
            'title' => 'Terms of Service',
            'content' => "Version one\nNo HTML is rendered.",
            'change_summary' => 'Initial terms',
            'requires_reconsent' => false,
        ])->assertCreated();
        $firstId = $first->json('data.id');
        $this->postJson("/api/v1/admin/platform-settings/policy-versions/{$firstId}/publish", ['revision' => 1])->assertOk();
        $second = $this->postJson("/api/v1/admin/platform-settings/policy-versions/{$firstId}/successor", [
            'change_summary' => 'Updated delivery terms',
        ])->assertCreated();
        $secondId = $second->json('data.id');
        $this->patchJson("/api/v1/admin/platform-settings/policy-versions/{$secondId}", [
            'title' => 'Terms of Service',
            'content' => 'Version two',
            'change_summary' => 'Updated delivery terms',
            'requires_reconsent' => true,
            'revision' => 1,
        ])->assertOk();

        $this->getJson('/api/v1/platform/policies/terms_of_service')
            ->assertOk()
            ->assertHeader('Cache-Control', 'max-age=300, public, s-maxage=300')
            ->assertJsonPath('data.version.id', $firstId)
            ->assertJsonPath('data.version.content', "Version one\nNo HTML is rendered.");

        $policy = PlatformPolicy::query()->where('type', 'terms_of_service')->firstOrFail();
        $cachedVersion = Cache::get($policy->cacheKey());
        $this->assertIsArray($cachedVersion);
        $this->assertSame($firstId, $cachedVersion['id']);

        $this->getJson('/api/v1/platform/policies/terms_of_service/history')
            ->assertOk()
            ->assertHeader('Cache-Control', 'max-age=60, public, s-maxage=60')
            ->assertJsonCount(1, 'data.versions')
            ->assertJsonPath('data.versions.0.id', $firstId)
            ->assertJsonMissingPath('data.versions.0.content');

        $this->getJson('/api/v1/platform/policies/terms_of_service/history/1')
            ->assertOk()
            ->assertHeader('Cache-Control', 'max-age=300, public, s-maxage=300')
            ->assertJsonPath('data.version.id', $firstId)
            ->assertJsonPath('data.version.content', "Version one\nNo HTML is rendered.");

        $this->getJson('/api/v1/platform/policies/internal_rules')->assertNotFound();
        $this->getJson('/api/v1/platform/policies/internal_rules/history')->assertNotFound();
    }

    private function adminWithSettingsPermissions(): User
    {
        // Public policy read/history assertions create their own policy
        // versions; protected-consent enforcement is covered separately.
        $this->withoutMiddleware(EnsurePolicyConsent::class);
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        AdminProfile::create(['user_id' => $admin->id, 'first_name' => 'Avery', 'last_name' => 'Admin']);
        foreach (['platform-settings.view', 'platform-settings.manage'] as $slug) {
            $permission = Permission::firstOrCreate(['slug' => $slug], ['name' => str($slug)->headline()]);
            $admin->permissions()->syncWithoutDetaching($permission);
        }

        return $admin;
    }
}
