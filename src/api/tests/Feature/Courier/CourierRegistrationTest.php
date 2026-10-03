<?php

namespace Tests\Feature\Courier;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Jobs\Logistics\DeliverLogisticsNotification;
use App\Models\Document;
use App\Models\User;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use PDOException;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\Support\CourierRegistrationFixtures;
use Tests\TestCase;
use Throwable;

class CourierRegistrationTest extends TestCase
{
    use CourierRegistrationFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['courier.registration.evidence_disk' => 'courier-registration-test']);
        Storage::fake('courier-registration-test');
        Bus::fake([DeliverLogisticsNotification::class]);
    }

    public function test_registration_creates_one_complete_pending_foundation_and_no_token(): void
    {
        $organization = $this->registrationOrganization();

        $this->postJson('/api/v1/courier/auth/register', $this->registrationPayload($organization->id, '  COURIER@EXAMPLE.COM  '))
            ->assertCreated()->assertJsonPath('message', 'Registration submitted for Logistics approval.')
            ->assertJsonPath('courier.email', 'courier@example.com')->assertJsonPath('courier.status', 'pending')
            ->assertJsonPath('courier.logistics.status', 'pending')->assertJsonMissingPath('token')
            ->assertJsonMissingPath('courier.password')->assertJsonMissingPath('courier.documents');

        $courier = User::query()->where('role', UserRole::Courier)->sole();
        $this->assertSame(UserStatus::Pending, $courier->status);
        $this->assertSame($organization->id, $courier->courierLogisticsAffiliation->logistics_organization_id);
        $this->assertSame($organization->hub->id, $courier->courierLogisticsAffiliation->logistics_hub_id);
        $this->assertSame(1, $courier->addresses()->count());
        $this->assertSame(1, $courier->registrationApplications()->count());
        $this->assertSame(1, $courier->courierProfile->vehicles()->count());
        $this->assertSame(2, $courier->documents()->count());
        foreach ($courier->documents as $document) {
            Storage::disk('courier-registration-test')->assertExists($document->path);
        }
        $this->assertCount(2, Storage::disk('courier-registration-test')->allFiles());
        $this->assertDatabaseCount('personal_access_tokens', 0);
        Bus::assertDispatchedTimes(DeliverLogisticsNotification::class, 1);
    }

    public function test_existing_normalized_courier_email_returns_the_exact_duplicate_error_without_side_effects(): void
    {
        $organization = $this->registrationOrganization();
        $winner = User::factory()->create(['email' => 'courier@example.com', 'role' => UserRole::Courier]);
        $attributes = $winner->fresh()->getAttributes();

        $this->postJson('/api/v1/courier/auth/register', $this->registrationPayload($organization->id, '  COURIER@EXAMPLE.COM  '))
            ->assertUnprocessable()->assertExactJson($this->duplicateRegistrationResponse());

        $this->assertSame($attributes, $winner->fresh()->getAttributes());
        $this->assertNoLosingRegistration();
    }

    #[DataProvider('otherRoles')]
    public function test_another_roles_email_does_not_block_courier_registration(UserRole $role): void
    {
        $organization = $this->registrationOrganization();
        $other = User::factory()->create(['email' => 'courier@example.com', 'role' => $role]);
        $attributes = $other->fresh()->getAttributes();

        $this->postJson('/api/v1/courier/auth/register', $this->registrationPayload($organization->id))
            ->assertCreated()->assertJsonPath('courier.role', 'courier');

        $this->assertSame(2, User::query()->where('email', 'courier@example.com')->count());
        $this->assertSame($attributes, $other->fresh()->getAttributes());
    }

    public static function otherRoles(): iterable
    {
        foreach ([UserRole::Customer, UserRole::Seller, UserRole::Admin, UserRole::Logistics] as $role) {
            yield $role->value => [$role];
        }
    }

    public function test_database_collision_after_a_negative_precheck_returns_the_exact_duplicate_error(): void
    {
        $organization = $this->registrationOrganization();
        $winner = null;
        $attributes = [];
        DB::listen(function (QueryExecuted $query) use (&$winner, &$attributes): void {
            if ($winner !== null || ! str_starts_with($query->sql, 'select exists(')
                || ! in_array('courier@example.com', $query->bindings, true)
                || ! in_array('courier', $query->bindings, true)) {
                return;
            }
            // The existence query has already returned false, before the registration transaction starts.
            $winner = User::factory()->make(['email' => 'courier@example.com', 'role' => UserRole::Courier]);
            $winner->save();
            $attributes = $winner->fresh()->getAttributes();
        });

        $this->postJson('/api/v1/courier/auth/register', $this->registrationPayload($organization->id, '  COURIER@EXAMPLE.COM  '))
            ->assertUnprocessable()->assertExactJson($this->duplicateRegistrationResponse());

        $this->assertNotNull($winner, 'The competing account must be inserted after the negative precheck.');
        $this->assertSame($attributes, $winner->fresh()->getAttributes());
        $this->assertNoLosingRegistration();
    }

    #[DataProvider('unrelatedFailures')]
    public function test_unrelated_failures_propagate_after_rollback_and_evidence_cleanup(string $failure): void
    {
        $organization = $this->registrationOrganization();
        $exception = $this->unrelatedException($failure);
        Document::creating(function () use ($exception): void {
            // The file is stored before Document creation, so every case exercises cleanup too.
            $this->assertCount(1, Storage::disk('courier-registration-test')->allFiles());
            throw $exception;
        });
        $this->withoutExceptionHandling();

        try {
            $this->postJson('/api/v1/courier/auth/register', $this->registrationPayload($organization->id));
            $this->fail('The unrelated failure must propagate.');
        } catch (Throwable $caught) {
            $this->assertSame($exception, $caught);
        }

        $this->assertSame(0, User::query()->where('role', UserRole::Courier)->count());
        $this->assertNoLosingRegistration();
    }

    public static function unrelatedFailures(): iterable
    {
        foreach (['primary-key', 'other-table', 'different-index', 'database', 'storage'] as $failure) {
            yield $failure => [$failure];
        }
    }

    private function unrelatedException(string $failure): Throwable
    {
        $cause = new PDOException('Injected persistence failure');
        $sql = 'insert into "users" ("id") values (?)';

        return match ($failure) {
            'primary-key' => (new UniqueConstraintViolationException(DB::getDefaultConnection(), $sql, [], $cause))
                ->setIndex('users_pkey')->setColumns(['id']),
            'other-table' => (new UniqueConstraintViolationException(DB::getDefaultConnection(), 'insert into "other" ("email", "role") values (?, ?)', [], $cause))
                ->setColumns(['email', 'role']),
            'different-index' => (new UniqueConstraintViolationException(DB::getDefaultConnection(), $sql, [], $cause))
                ->setIndex('other_email_role_unique')->setColumns(['email', 'role']),
            'database' => new QueryException(DB::getDefaultConnection(), $sql, [], $cause),
            'storage' => new RuntimeException('Injected storage failure'),
        };
    }

    private function assertNoLosingRegistration(): void
    {
        $this->assertDatabaseCount('courier_profiles', 0);
        $this->assertDatabaseCount('courier_logistics_affiliations', 0);
        $this->assertDatabaseCount('registration_applications', 0);
        $this->assertDatabaseCount('vehicles', 0);
        $this->assertDatabaseCount('documents', 0);
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertDatabaseCount('notifications', 0);
        $this->assertSame(0, DB::table('addresses')->where('label', 'Courier address')->count());
        $this->assertCount(0, Storage::disk('courier-registration-test')->allFiles());
        Bus::assertNothingDispatched();
    }
}
