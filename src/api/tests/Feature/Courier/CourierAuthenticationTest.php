<?php

namespace Tests\Feature\Courier;

use App\Enums\AddressType;
use App\Enums\CourierAffiliationStatus;
use App\Enums\PlatformPolicyType;
use App\Enums\PlatformPolicyVersionStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\PlatformPolicy;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class CourierAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    #[DataProvider('accountDenials')]
    public function test_inactive_accounts_have_identical_login_and_bearer_denials_before_affiliation_checks(
        UserStatus $status,
        string $code,
        ?CourierAffiliationStatus $affiliationStatus,
    ): void {
        $courier = $this->courier();
        $token = $courier->createToken('existing-phone', ['courier'])->plainTextToken;
        $this->me($token)->assertOk();

        $courier->update(['status' => $status]);
        if ($affiliationStatus === null) {
            $courier->courierLogisticsAffiliation()->delete();
        } else {
            $courier->courierLogisticsAffiliation()->update(['status' => $affiliationStatus]);
        }

        $this->assertMatchingDenials($courier, $token, $code, 'This Courier account is not active.');
    }

    public static function accountDenials(): iterable
    {
        foreach ([
            [UserStatus::Pending, 'ACCOUNT_PENDING_APPROVAL'],
            [UserStatus::Rejected, 'ACCOUNT_REJECTED'],
            [UserStatus::Suspended, 'ACCOUNT_SUSPENDED'],
            [UserStatus::Deactivated, 'ACCOUNT_INACTIVE'],
        ] as [$status, $code]) {
            foreach ([CourierAffiliationStatus::Approved, CourierAffiliationStatus::Rejected, null] as $affiliation) {
                yield $status->value.' / '.($affiliation?->value ?? 'missing') => [$status, $code, $affiliation];
            }
        }
    }

    #[DataProvider('invalidAffiliations')]
    public function test_active_accounts_with_invalid_affiliations_have_identical_denials(?CourierAffiliationStatus $status): void
    {
        $courier = $this->courier();
        $token = $courier->createToken('existing-phone', ['courier'])->plainTextToken;
        $this->me($token)->assertOk();

        if ($status === null) {
            $courier->courierLogisticsAffiliation()->delete();
        } else {
            $courier->courierLogisticsAffiliation()->update(['status' => $status]);
        }

        $this->assertInvalidAssociation($courier, $token);
    }

    public static function invalidAffiliations(): iterable
    {
        yield 'missing' => [null];
        yield 'pending' => [CourierAffiliationStatus::Pending];
        yield 'rejected' => [CourierAffiliationStatus::Rejected];
        yield 'revoked' => [CourierAffiliationStatus::Revoked];
    }

    #[DataProvider('inactiveOwners')]
    public function test_inactive_logistics_owners_have_identical_denials(UserStatus $status): void
    {
        $courier = $this->courier();
        $token = $courier->createToken('existing-phone', ['courier'])->plainTextToken;
        $this->me($token)->assertOk();
        $courier->courierLogisticsAffiliation->organization->user->update(['status' => $status]);

        $this->assertInvalidAssociation($courier, $token);
    }

    public static function inactiveOwners(): iterable
    {
        foreach ([UserStatus::Pending, UserStatus::Rejected, UserStatus::Suspended, UserStatus::Deactivated] as $status) {
            yield $status->value => [$status];
        }
    }

    public function test_missing_hub_has_identical_denials(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            $this->markTestSkipped('Orphaned hub fixture uses SQLite deferred foreign keys.');
        }

        $courier = $this->courier();
        $token = $courier->createToken('existing-phone', ['courier'])->plainTextToken;
        $this->me($token)->assertOk();
        $affiliation = $courier->courierLogisticsAffiliation;
        $hubId = $affiliation->logistics_hub_id;

        // Simulate legacy orphaned data inside the rolled-back test transaction.
        DB::statement('PRAGMA defer_foreign_keys = ON');
        try {
            $affiliation->update(['logistics_hub_id' => (string) Str::uuid()]);
            $this->assertInvalidAssociation($courier, $token);
        } finally {
            $affiliation->update(['logistics_hub_id' => $hubId]);
        }
    }

    public function test_active_approved_login_issues_only_courier_scope_and_logout_revokes_only_current_token(): void
    {
        $courier = $this->courier();
        $otherToken = $courier->createToken('other-phone', ['courier']);
        $login = $this->login($courier)->assertOk()
            ->assertJsonPath('courier.id', $courier->id)
            ->assertJsonPath('courier.role', 'courier')
            ->assertJsonPath('courier.status', 'active')
            ->assertJsonPath('courier.logistics.status', 'approved')
            ->assertJsonMissingPath('courier.password');

        $token = $login->json('token');
        $this->assertIsString($token);
        $issued = $courier->tokens()->where('name', 'test-phone')->sole();
        $this->assertSame(['courier'], $issued->abilities);
        $this->assertDatabaseCount('personal_access_tokens', 2);
        $this->me($token)->assertOk()
            ->assertExactJson(['courier' => $login->json('courier')])
            ->assertJsonMissingPath('token');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson('/api/v1/courier/auth/logout')
            ->assertOk()->assertExactJson(['message' => 'Signed out successfully.']);
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $issued->id]);
        $this->assertDatabaseCount('personal_access_tokens', 1);
        $this->me($token)->assertUnauthorized();
        $this->me($otherToken->plainTextToken)->assertOk();
    }

    public function test_invalid_credentials_remain_generic_before_status_or_affiliation_checks(): void
    {
        $courier = $this->courier();
        $this->login($courier, 'wrong-password')->assertUnprocessable()->assertExactJson([
            'code' => 'INVALID_CREDENTIALS', 'message' => 'The email or password is incorrect.',
        ]);
        $courier->update(['status' => UserStatus::Rejected]);
        $courier->courierLogisticsAffiliation()->delete();
        $this->login($courier, 'wrong-password')->assertUnprocessable()->assertExactJson([
            'code' => 'INVALID_CREDENTIALS', 'message' => 'The email or password is incorrect.',
        ]);
        $courier->email = 'unknown@example.com';
        $this->login($courier)->assertUnprocessable()->assertExactJson([
            'code' => 'INVALID_CREDENTIALS', 'message' => 'The email or password is incorrect.',
        ]);
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_wrong_role_is_rejected_before_account_status_on_protected_requests(): void
    {
        $customer = User::factory()->create([
            'role' => UserRole::Customer, 'status' => UserStatus::Pending, 'password' => 'CourierPassword123',
        ]);
        $this->login($customer)->assertUnprocessable()->assertExactJson([
            'code' => 'INVALID_CREDENTIALS', 'message' => 'The email or password is incorrect.',
        ]);
        $this->assertDatabaseCount('personal_access_tokens', 0);

        $token = $customer->createToken('customer-phone', ['customer'])->plainTextToken;
        $this->me($token)->assertForbidden()->assertExactJson([
            'code' => 'FORBIDDEN_ROLE', 'message' => 'This area is restricted to couriers.',
        ]);
    }

    public function test_guests_cannot_read_identity_or_logout(): void
    {
        $this->getJson('/api/v1/courier/auth/me')->assertUnauthorized();
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/v1/courier/auth/logout')->assertUnauthorized();
    }

    public function test_login_still_throttles_invalid_credentials_and_prohibits_client_scope(): void
    {
        $courier = $this->courier();
        $this->postJson('/api/v1/courier/auth/login', [
            'email' => $courier->email, 'password' => 'CourierPassword123', 'device_name' => 'test-phone',
            'role' => 'courier', 'abilities' => ['*'],
        ])->assertUnprocessable()->assertJsonValidationErrors(['role', 'abilities']);

        for ($attempt = 0; $attempt < 5; $attempt++) {
            $this->login($courier, 'wrong-password')->assertUnprocessable();
        }
        $this->login($courier)->assertTooManyRequests()->assertHeader('Retry-After')->assertJsonPath('code', 'RATE_LIMITED');
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_consent_does_not_block_auth_but_still_blocks_operational_access(): void
    {
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        $policy = PlatformPolicy::create(['type' => PlatformPolicyType::TermsOfService]);
        $version = $policy->versions()->create([
            'version' => 1, 'title' => 'Terms of Service', 'content' => 'Current Terms',
            'status' => PlatformPolicyVersionStatus::Published, 'requires_reconsent' => false, 'revision' => 1,
            'created_by_admin_id' => $admin->id, 'published_by_admin_id' => $admin->id, 'published_at' => now(),
        ]);
        $policy->update(['current_version_id' => $version->id]);

        $courier = $this->courier();
        $token = $this->login($courier)->assertOk()->json('token');
        $this->me($token)->assertOk();
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/v1/courier/dashboard')
            ->assertForbidden()->assertJsonPath('code', 'POLICY_CONSENT_REQUIRED');
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson('/api/v1/courier/auth/logout')->assertOk();
    }

    private function assertInvalidAssociation(User $courier, string $token): void
    {
        $this->assertMatchingDenials($courier, $token, 'LOGISTICS_ASSOCIATION_INVALID', 'This Courier is not approved by an active Logistics organization.');
    }

    private function assertMatchingDenials(User $courier, string $token, string $code, string $message): void
    {
        $tokenCount = $courier->tokens()->count();
        $login = $this->login($courier)->assertForbidden()->assertExactJson(['code' => $code, 'message' => $message]);
        $this->assertSame($tokenCount, $courier->tokens()->count());
        $this->me($token)->assertForbidden()->assertExactJson($login->json());
    }

    private function login(User $courier, string $password = 'CourierPassword123'): TestResponse
    {
        $this->app['auth']->forgetGuards();
        $this->flushHeaders();

        return $this->postJson('/api/v1/courier/auth/login', [
            'email' => $courier->email, 'password' => $password, 'device_name' => 'test-phone',
        ]);
    }

    private function me(string $token): TestResponse
    {
        $this->app['auth']->forgetGuards();

        return $this->withToken($token)->getJson('/api/v1/courier/auth/me');
    }

    private function courier(): User
    {
        $logistics = User::factory()->create(['role' => UserRole::Logistics, 'status' => UserStatus::Active]);
        $address = $logistics->addresses()->create([
            'type' => AddressType::Both, 'label' => 'Hub', 'recipient_name' => 'Logistics Operator',
            'contact_number' => '09171234567', 'address_line_1' => '1 Hub Road', 'barangay' => 'Poblacion',
            'city_municipality' => 'Makati City', 'province' => 'Metro Manila', 'region' => 'National Capital Region',
            'postal_code' => '1200', 'country' => 'Philippines', 'is_default' => true,
        ]);
        $organization = $logistics->logisticsOrganization()->create(['business_name' => 'Test Logistics']);
        $hub = $organization->hub()->create(['address_id' => $address->id, 'name' => 'Test hub']);
        $courier = User::factory()->create([
            'role' => UserRole::Courier, 'status' => UserStatus::Active, 'password' => 'CourierPassword123',
        ]);
        $courier->courierProfile()->create([
            'first_name' => 'Cora', 'last_name' => 'Rider', 'contact_number' => '09171234568',
            'sex' => 'female', 'birth_date' => '1994-06-15',
        ]);
        $courier->courierLogisticsAffiliation()->create([
            'logistics_organization_id' => $organization->id, 'logistics_hub_id' => $hub->id,
            'status' => CourierAffiliationStatus::Approved,
        ]);

        return $courier;
    }
}
