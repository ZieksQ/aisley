<?php

namespace Tests\Feature\Shared;

use App\Enums\PlatformPolicyType;
use App\Enums\PlatformPolicyVersionStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\PlatformPolicy;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PolicyConsentTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_roles_receive_private_shared_policy_status(): void
    {
        $this->getJson('/api/v1/policy-consent/status')->assertUnauthorized();
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $this->publishSharedPolicies($admin);
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);

        Sanctum::actingAs($customer);

        $this->getJson('/api/v1/policy-consent/status')
            ->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertHeader('Pragma', 'no-cache')
            ->assertJsonPath('data.all_required_accepted', false)
            ->assertJsonPath('data.policies.0.type', 'terms_of_service')
            ->assertJsonPath('data.policies.0.current_version.version', 1)
            ->assertJsonPath('data.policies.0.required', true)
            ->assertJsonPath('data.policies.0.accepted', false)
            ->assertJsonPath('data.policies.1.type', 'privacy_policy')
            ->assertJsonPath('data.policies.1.current_version.version', 1);
    }

    public function test_each_active_non_courier_account_role_uses_the_same_shared_status_projection(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $this->publishSharedPolicies($admin);

        foreach ([UserRole::Customer, UserRole::Seller, UserRole::Admin, UserRole::Logistics] as $role) {
            $user = User::factory()->create(['role' => $role, 'status' => UserStatus::Active]);
            Sanctum::actingAs($user);

            $this->getJson('/api/v1/policy-consent/status')
                ->assertOk()
                ->assertJsonPath('data.policies.0.type', 'terms_of_service')
                ->assertJsonPath('data.policies.1.type', 'privacy_policy')
                ->assertJsonPath('data.all_required_accepted', false);
        }
    }

    public function test_acceptance_is_server_owned_idempotent_and_version_specific(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $policies = $this->publishSharedPolicies($admin);
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        Sanctum::actingAs($customer);

        $accepted = $this->postJson('/api/v1/policy-consent/terms_of_service/versions/1/accept', [
            'confirmation' => true,
        ])->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.type', 'terms_of_service')
            ->assertJsonPath('data.version.id', $policies['terms_of_service']->current_version_id)
            ->assertJsonPath('data.version.content', 'Shared Terms v1')
            ->assertJsonPath('data.accepted_at', fn ($value) => is_string($value));

        $acceptedAt = $accepted->json('data.accepted_at');
        $this->postJson('/api/v1/policy-consent/terms_of_service/versions/1/accept', ['confirmation' => true])
            ->assertOk()
            ->assertJsonPath('data.accepted_at', $acceptedAt);
        $this->assertDatabaseCount('policy_acceptances', 1);

        $this->postJson('/api/v1/policy-consent/privacy_policy/versions/1/accept', [
            'confirmation' => true,
            'user_id' => $admin->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('user_id');

        $this->postJson('/api/v1/policy-consent/privacy_policy/versions/1/accept', ['confirmation' => false])
            ->assertUnprocessable()->assertJsonValidationErrors('confirmation');

        $this->postJson('/api/v1/policy-consent/privacy_policy/versions/99/accept', ['confirmation' => true])
            ->assertConflict()->assertJsonPath('code', 'POLICY_VERSION_STALE');

        $this->postJson('/api/v1/policy-consent/internal_rules/versions/1/accept', ['confirmation' => true])
            ->assertNotFound();

        $this->getJson('/api/v1/policy-consent/status')
            ->assertOk()
            ->assertJsonPath('data.policies.0.accepted', true)
            ->assertJsonPath('data.policies.0.required', false)
            ->assertJsonPath('data.policies.1.required', true)
            ->assertJsonPath('data.all_required_accepted', false);
    }

    public function test_reconsent_flag_requires_the_exact_new_shared_version(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $policies = $this->publishSharedPolicies($admin);
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        Sanctum::actingAs($customer);

        $this->postJson('/api/v1/policy-consent/terms_of_service/versions/1/accept', ['confirmation' => true])->assertOk();

        $next = $policies['terms_of_service']->versions()->create([
            'version' => 2,
            'title' => 'Terms of Service',
            'content' => 'Shared Terms v2',
            'status' => PlatformPolicyVersionStatus::Published,
            'requires_reconsent' => true,
            'revision' => 1,
            'created_by_admin_id' => $admin->id,
            'published_by_admin_id' => $admin->id,
            'published_at' => now(),
        ]);
        $policies['terms_of_service']->update(['current_version_id' => $next->id]);

        $this->getJson('/api/v1/policy-consent/status')
            ->assertOk()
            ->assertJsonPath('data.policies.0.current_version.version', 2)
            ->assertJsonPath('data.policies.0.accepted', false)
            ->assertJsonPath('data.policies.0.required', true);

        $this->postJson('/api/v1/policy-consent/terms_of_service/versions/2/accept', ['confirmation' => true])
            ->assertOk();
        $this->assertDatabaseCount('policy_acceptances', 2);
    }

    public function test_inactive_accounts_cannot_use_consent(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $this->publishSharedPolicies($admin);
        $suspended = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Suspended]);
        Sanctum::actingAs($suspended);

        $this->getJson('/api/v1/policy-consent/status')
            ->assertForbidden()
            ->assertJsonPath('code', 'ACCOUNT_SUSPENDED');
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
