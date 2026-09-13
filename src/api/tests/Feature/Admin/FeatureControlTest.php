<?php

namespace Tests\Feature\Admin;

use App\Enums\PlatformPolicyType;
use App\Enums\PlatformPolicyVersionStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AdminProfile;
use App\Models\Permission;
use App\Models\PlatformFeatureControl;
use App\Models\PlatformPolicy;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FeatureControlTest extends TestCase
{
    use RefreshDatabase;

    public function test_feature_controls_use_admin_platform_settings_permissions(): void
    {
        $this->getJson('/api/v1/admin/platform-settings/feature-controls')->assertUnauthorized();

        $admin = $this->admin();
        Sanctum::actingAs($admin);
        $this->getJson('/api/v1/admin/platform-settings/feature-controls')->assertForbidden();

        $this->grant($admin, 'platform-settings.view');
        $this->getJson('/api/v1/admin/platform-settings/feature-controls')->assertOk();
        $this->patchJson('/api/v1/admin/platform-settings/feature-controls/'.PlatformFeatureControl::POLICY_CONSENT_ENFORCEMENT, [
            'enabled' => false,
            'revision' => 1,
        ])->assertForbidden();
    }

    public function test_admin_can_toggle_policy_consent_enforcement_with_revision_and_audit_data(): void
    {
        $admin = $this->admin();
        $this->grant($admin, 'platform-settings.view');
        $this->grant($admin, 'platform-settings.manage');
        $control = PlatformFeatureControl::create([
            'key' => PlatformFeatureControl::POLICY_CONSENT_ENFORCEMENT,
            'label' => 'Require Terms & Privacy consent',
            'description' => 'Require current policy acceptance before protected access.',
            'enabled' => true,
            'revision' => 1,
        ]);
        $this->publishSharedPolicies($admin);

        Sanctum::actingAs($admin);
        $this->postJson('/api/v1/policy-consent/terms_of_service/versions/1/accept', ['confirmation' => true])->assertOk();
        $this->postJson('/api/v1/policy-consent/privacy_policy/versions/1/accept', ['confirmation' => true])->assertOk();
        $this->getJson('/api/v1/admin/platform-settings/feature-controls')
            ->assertOk()
            ->assertJsonPath('data.0.key', PlatformFeatureControl::POLICY_CONSENT_ENFORCEMENT)
            ->assertJsonPath('data.0.enabled', true)
            ->assertJsonPath('data.0.revision', 1);

        $this->patchJson('/api/v1/admin/platform-settings/feature-controls/'.PlatformFeatureControl::POLICY_CONSENT_ENFORCEMENT, [
            'enabled' => false,
            'revision' => $control->revision,
        ])->assertOk()
            ->assertJsonPath('data.enabled', false)
            ->assertJsonPath('data.revision', 2)
            ->assertJsonPath('data.updated_by.email', $admin->email);

        $this->getJson('/api/v1/admin/dashboard')->assertOk();

        $this->patchJson('/api/v1/admin/platform-settings/feature-controls/'.PlatformFeatureControl::POLICY_CONSENT_ENFORCEMENT, [
            'enabled' => true,
            'revision' => 1,
        ])->assertConflict();

        $this->assertDatabaseHas('audit_outbox', [
            'action' => 'platform_settings.feature_control_updated',
        ]);
    }

    public function test_disabling_the_control_marks_unaccepted_policies_as_not_required(): void
    {
        $admin = $this->admin();
        $this->publishSharedPolicies($admin);
        PlatformFeatureControl::create([
            'key' => PlatformFeatureControl::POLICY_CONSENT_ENFORCEMENT,
            'label' => 'Require Terms & Privacy consent',
            'enabled' => false,
        ]);
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        Sanctum::actingAs($customer);

        $this->getJson('/api/v1/policy-consent/status')
            ->assertOk()
            ->assertJsonPath('data.all_required_accepted', true)
            ->assertJsonPath('data.policies.0.required', false)
            ->assertJsonPath('data.policies.1.required', false);
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

    /** @return array<string, PlatformPolicy> */
    private function publishSharedPolicies(User $admin): array
    {
        $policies = [];
        foreach ([PlatformPolicyType::TermsOfService, PlatformPolicyType::PrivacyPolicy] as $type) {
            $policy = PlatformPolicy::create(['type' => $type]);
            $version = $policy->versions()->create([
                'version' => 1,
                'title' => $type->label(),
                'content' => $type === PlatformPolicyType::TermsOfService ? 'Shared Terms v1' : 'Shared Privacy v1',
                'status' => PlatformPolicyVersionStatus::Published,
                'requires_reconsent' => false,
                'revision' => 1,
                'created_by_admin_id' => $admin->id,
                'published_by_admin_id' => $admin->id,
                'published_at' => now(),
            ]);
            $policy->update(['current_version_id' => $version->id]);
            $policies[$type->value] = $policy->fresh('currentVersion');
        }

        return $policies;
    }
}
