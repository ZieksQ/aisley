<?php

namespace Tests\Feature\Shared;

use App\Enums\CourierAffiliationStatus;
use App\Enums\PlatformPolicyType;
use App\Enums\PlatformPolicyVersionStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\PlatformPolicy;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CombinedPolicyConsentTest extends TestCase
{
    use RefreshDatabase;

    private function publish(): array
    {
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $policies = [];
        foreach ([PlatformPolicyType::TermsOfService, PlatformPolicyType::PrivacyPolicy] as $type) {
            $policy = PlatformPolicy::create(['type' => $type]);
            $version = $policy->versions()->create([
                'version' => 1, 'title' => $type->label(), 'content' => 'Complete '.$type->label(),
                'status' => PlatformPolicyVersionStatus::Published, 'requires_reconsent' => true,
                'revision' => 1, 'created_by_admin_id' => $admin->id,
                'published_by_admin_id' => $admin->id, 'published_at' => now(),
            ]);
            $policy->update(['current_version_id' => $version->id]);
            $policies[$type->value] = $policy;
        }

        return $policies;
    }

    private function selections(): array
    {
        return ['acceptances' => array_map(fn ($type) => [
            'type' => $type, 'version' => 1, 'confirmation' => true,
        ], ['terms_of_service', 'privacy_policy'])];
    }

    public function test_active_web_roles_accept_both_atomically_and_retries_preserve_timestamps(): void
    {
        $this->publish();
        foreach ([UserRole::Customer, UserRole::Seller, UserRole::Admin, UserRole::Logistics] as $role) {
            $user = User::factory()->create(['role' => $role, 'status' => UserStatus::Active]);
            Sanctum::actingAs($user);
            $response = $this->postJson('/api/v1/policy-consent/accept', $this->selections())
                ->assertOk()->assertHeader('Cache-Control', 'no-store, private')
                ->assertHeader('Pragma', 'no-cache')->assertJsonCount(2, 'data.acceptances')
                ->assertJsonPath('data.status.all_required_accepted', true);
            $first = $response->json('data.acceptances');
            $this->travel(1)->minutes();
            $this->postJson('/api/v1/policy-consent/accept', $this->selections())
                ->assertOk()->assertJsonPath('data.acceptances', $first);
            $this->assertSame(2, DB::table('policy_acceptances')->where('user_id', $user->id)->count());
        }
    }

    public function test_approved_courier_can_accept_with_a_scoped_bearer(): void
    {
        $this->publish();
        $logistics = User::factory()->create(['role' => UserRole::Logistics, 'status' => UserStatus::Active]);
        $address = $logistics->addresses()->create([
            'type' => 'both', 'label' => 'Hub', 'recipient_name' => 'Operator', 'contact_number' => '09171234567',
            'address_line_1' => '1 Hub Road', 'barangay' => 'Poblacion', 'city_municipality' => 'Makati',
            'province' => 'Metro Manila', 'region' => 'National Capital Region', 'postal_code' => '1200',
            'country' => 'Philippines', 'is_default' => true,
        ]);
        $organization = $logistics->logisticsOrganization()->create(['business_name' => 'Consent test organization']);
        $hub = $organization->hub()->create(['address_id' => $address->id, 'name' => 'Hub']);
        $courier = User::factory()->create(['role' => UserRole::Courier, 'status' => UserStatus::Active]);
        $courier->courierLogisticsAffiliation()->create([
            'logistics_organization_id' => $organization->id, 'logistics_hub_id' => $hub->id,
            'status' => CourierAffiliationStatus::Approved,
        ]);
        $token = $courier->createToken('consent-test', ['courier'])->plainTextToken;
        $this->withToken($token)->postJson('/api/v1/policy-consent/accept', $this->selections())
            ->assertOk()->assertJsonPath('data.status.all_required_accepted', true);
        $this->assertSame(2, DB::table('policy_acceptances')->where('user_id', $courier->id)->count());
    }

    public function test_missing_required_policy_and_stale_selection_write_nothing(): void
    {
        $this->publish();
        Sanctum::actingAs(User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]));
        $selection = $this->selections();
        array_pop($selection['acceptances']);
        $this->postJson('/api/v1/policy-consent/accept', $selection)->assertConflict()->assertJsonPath('code', 'POLICY_VERSION_STALE');
        $selection = $this->selections();
        $selection['acceptances'][1]['version'] = 99;
        $this->postJson('/api/v1/policy-consent/accept', $selection)->assertConflict();
        $this->assertDatabaseCount('policy_acceptances', 0);
    }

    public function test_only_pending_policy_is_required_and_covered_acceptance_is_unchanged(): void
    {
        $this->publish();
        Sanctum::actingAs(User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]));
        $first = $this->postJson('/api/v1/policy-consent/terms_of_service/versions/1/accept', ['confirmation' => true])->assertOk()->json('data.accepted_at');
        $this->travel(1)->minutes();
        $this->postJson('/api/v1/policy-consent/accept', ['acceptances' => [$this->selections()['acceptances'][1]]])
            ->assertOk()->assertJsonCount(1, 'data.acceptances')->assertJsonPath('data.status.all_required_accepted', true);
        $this->getJson('/api/v1/policy-consent/status')->assertJsonPath('data.policies.0.accepted_at', $first);
        $this->assertDatabaseCount('policy_acceptances', 2);
    }

    public function test_publication_rejects_old_versions_and_newly_missing_requirements(): void
    {
        $policies = $this->publish();
        Sanctum::actingAs(User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]));
        $this->postJson('/api/v1/policy-consent/terms_of_service/versions/1/accept', ['confirmation' => true])->assertOk();
        $policy = $policies['terms_of_service'];
        $old = $policy->currentVersion;
        $successor = $policy->versions()->create([
            'version' => 2, 'title' => 'Updated Terms', 'content' => 'Updated published text',
            'status' => PlatformPolicyVersionStatus::Published, 'requires_reconsent' => true,
            'revision' => 1, 'created_by_admin_id' => $old->created_by_admin_id,
            'published_by_admin_id' => $old->published_by_admin_id, 'published_at' => now(),
        ]);
        $old->update(['status' => PlatformPolicyVersionStatus::Superseded]);
        $policy->update(['current_version_id' => $successor->id]);
        $this->postJson('/api/v1/policy-consent/accept', ['acceptances' => [$this->selections()['acceptances'][1]]])
            ->assertConflict()->assertJsonPath('code', 'POLICY_VERSION_STALE');
        $this->postJson('/api/v1/policy-consent/accept', $this->selections())->assertConflict();
        $this->assertDatabaseCount('policy_acceptances', 1);
        $payload = $this->selections();
        $payload['acceptances'][0]['version'] = 2;
        $this->postJson('/api/v1/policy-consent/accept', $payload)->assertOk()->assertJsonPath('data.status.all_required_accepted', true);
        $this->assertDatabaseCount('policy_acceptances', 3);
    }

    public function test_strict_validation_and_actor_guards(): void
    {
        $this->publish();
        $this->postJson('/api/v1/policy-consent/accept', $this->selections())->assertUnauthorized();
        Sanctum::actingAs(User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]));
        $invalid = [[], ['acceptances' => []], ['acceptances' => [$this->selections()['acceptances'][0], $this->selections()['acceptances'][0]]]];
        foreach (['internal_rules'] as $type) {
            $payload = $this->selections();
            $payload['acceptances'][0]['type'] = $type;
            $invalid[] = $payload;
        }
        foreach ([false, null, 'yes', 1] as $confirmation) {
            $payload = $this->selections();
            $payload['acceptances'][0]['confirmation'] = $confirmation;
            $invalid[] = $payload;
        }
        $invalid[] = [...$this->selections(), 'user_id' => 'forged'];
        $payload = $this->selections();
        $payload['acceptances'][0]['accepted_at'] = now()->toIso8601String();
        $invalid[] = $payload;
        foreach ($invalid as $payload) {
            $this->postJson('/api/v1/policy-consent/accept', $payload)->assertUnprocessable();
        }
        $this->assertDatabaseCount('policy_acceptances', 0);
        Sanctum::actingAs(User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Suspended]));
        $this->postJson('/api/v1/policy-consent/accept', $this->selections())->assertForbidden();
        Sanctum::actingAs(User::factory()->create(['role' => UserRole::Courier, 'status' => UserStatus::Active]));
        $this->postJson('/api/v1/policy-consent/accept', $this->selections())->assertForbidden()->assertJsonPath('code', 'LOGISTICS_ASSOCIATION_INVALID');
    }

    public function test_database_failure_rolls_back_every_acceptance(): void
    {
        $this->publish();
        Sanctum::actingAs(User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]));
        $this->withoutExceptionHandling();
        $failed = false;
        DB::listen(function ($query) use (&$failed) {
            if (! $failed && str_contains($query->sql, 'insert') && str_contains($query->sql, 'policy_acceptances')) {
                $failed = true;
                throw new \RuntimeException('Synthetic storage failure');
            }
        });
        try {
            $this->postJson('/api/v1/policy-consent/accept', $this->selections());
            $this->fail('Storage failure should escape the transaction.');
        } catch (\RuntimeException $error) {
            $this->assertSame('Synthetic storage failure', $error->getMessage());
        }
        $this->assertDatabaseCount('policy_acceptances', 0);
    }
}
