<?php

namespace Tests\Feature\Courier;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Document;
use App\Models\User;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\Support\CourierRegistrationFixtures;
use Tests\TestCase;
use Throwable;

class PostgresCourierRegistrationConcurrencyTest extends TestCase
{
    use CourierRegistrationFixtures;

    private string $evidenceRoot;

    protected function setUp(): void
    {
        parent::setUp();

        $database = (string) config('database.connections.pgsql.database');
        if (DB::getDriverName() !== 'pgsql' || ! str_contains($database, '_courier_registration_verify_')
            || getenv('COURIER_REGISTRATION_CONCURRENCY_TEST_DB') !== $database || ! function_exists('pcntl_fork')) {
            $this->markTestSkipped('Requires an explicitly named disposable Courier-registration PostgreSQL database and pcntl.');
        }
        $this->artisan('migrate:fresh', ['--force' => true])->assertExitCode(0);
        $this->evidenceRoot = storage_path('framework/testing/courier-registration-race-'.Str::uuid());
        config([
            'courier.registration.evidence_disk' => 'courier-registration-race',
            'filesystems.disks.courier-registration-race' => ['driver' => 'local', 'root' => $this->evidenceRoot, 'throw' => true],
            'queue.default' => 'sync',
        ]);
    }

    protected function tearDown(): void
    {
        try {
            if (isset($this->evidenceRoot)) {
                $this->app['files']->deleteDirectory($this->evidenceRoot);
            }
        } finally {
            parent::tearDown();
        }
    }

    #[DataProvider('organizationSelections')]
    public function test_two_requests_passing_the_precheck_commit_only_one_registration(bool $differentOrganizations): void
    {
        $first = $this->registrationOrganization();
        $second = $differentOrganizations ? $this->registrationOrganization() : $first;
        $customer = User::factory()->create(['email' => 'courier@example.com', 'role' => UserRole::Customer]);
        $customerAttributes = $customer->fresh()->getAttributes();

        $responses = $this->workers([$first->id, $second->id]);
        usort($responses, fn (array $left, array $right) => $left['status'] <=> $right['status']);
        $this->assertSame([201, 422], array_column($responses, 'status'));
        $this->assertSame([true, true], array_column($responses, 'passed_precheck'));
        $this->assertSame($this->duplicateRegistrationResponse(), $responses[1]['body']);
        $this->assertArrayNotHasKey('token', $responses[0]['body']);

        $courier = User::query()->where('role', UserRole::Courier)->sole();
        $this->assertSame($courier->id, $responses[0]['body']['courier']['id']);
        $this->assertSame(UserStatus::Pending, $courier->status);
        $this->assertSame('courier@example.com', $courier->email);
        $this->assertSame($customerAttributes, $customer->fresh()->getAttributes());
        $this->assertDatabaseCount('courier_profiles', 1);
        $this->assertDatabaseCount('courier_logistics_affiliations', 1);
        $this->assertDatabaseCount('registration_applications', 1);
        $this->assertDatabaseCount('vehicles', 1);
        $this->assertDatabaseCount('documents', 2);
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertSame(1, DB::table('addresses')->where('label', 'Courier address')->count());
        $this->assertSame('pending', $courier->courierLogisticsAffiliation->status->value);
        $this->assertSame('pending', $courier->registrationApplications()->sole()->status->value);
        $this->assertSame($responses[0]['organization_id'], $courier->courierLogisticsAffiliation->logistics_organization_id);
        $this->assertSame($courier->courierLogisticsAffiliation->organization->hub->id, $courier->courierLogisticsAffiliation->logistics_hub_id);
        $this->assertSame($courier->courierProfile->id, $courier->courierProfile->vehicles()->sole()->courier_profile_id);
        foreach (Document::all() as $document) {
            $this->assertSame($courier->id, $document->user_id);
            $this->assertSame($courier->registrationApplications()->sole()->id, $document->registration_application_id);
            Storage::disk('courier-registration-race')->assertExists($document->path);
        }
        $this->assertCount(2, Storage::disk('courier-registration-race')->allFiles());
        $this->assertDatabaseCount('notifications', 1);
        $this->assertDatabaseHas('notifications', [
            'type' => 'logistics-courier.application-pending',
            'notifiable_id' => $courier->courierLogisticsAffiliation->organization->user_id,
        ]);
    }

    public static function organizationSelections(): iterable
    {
        yield 'same Logistics organization' => [false];
        yield 'different Logistics organizations' => [true];
    }

    /** @param list<string> $organizationIds */
    private function workers(array $organizationIds): array
    {
        $children = [];
        DB::disconnect('pgsql');

        try {
            foreach ($organizationIds as $index => $organizationId) {
                $sockets = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, 0);
                if ($sockets === false) {
                    throw new RuntimeException('Unable to create registration worker socket.');
                }
                $pid = pcntl_fork();
                if ($pid === -1) {
                    fclose($sockets[0]);
                    fclose($sockets[1]);
                    throw new RuntimeException('Unable to fork registration worker.');
                }
                if ($pid === 0) {
                    fclose($sockets[0]);
                    foreach ($children as [, $inheritedSocket]) {
                        fclose($inheritedSocket);
                    }
                    $this->runWorker($sockets[1], $organizationId, $index);
                }
                fclose($sockets[1]);
                stream_set_timeout($sockets[0], 15);
                $children[] = [$pid, $sockets[0]];
            }

            // Release neither request until both have executed their negative existence query.
            foreach ($children as [, $socket]) {
                $this->assertSame("ready\n", fgets($socket), 'Worker did not reach the duplicate precheck.');
            }
            foreach ($children as [, $socket]) {
                fwrite($socket, '1');
            }
            $responses = [];
            foreach ($children as [, $socket]) {
                $line = fgets($socket);
                $this->assertIsString($line, 'Worker did not finish within the socket timeout.');
                $responses[] = json_decode($line, true, flags: JSON_THROW_ON_ERROR);
            }

            return $responses;
        } finally {
            $workerStatuses = [];
            foreach ($children as [$pid, $socket]) {
                fclose($socket);
                pcntl_waitpid($pid, $status);
                $workerStatuses[] = $status;
            }
            DB::purge('pgsql');
            foreach ($workerStatuses as $status) {
                $this->assertTrue(pcntl_wifexited($status), 'Registration worker terminated before completing.');
                $this->assertSame(0, pcntl_wexitstatus($status), 'Registration worker failed.');
            }
        }
    }

    /** @param resource $socket */
    private function runWorker($socket, string $organizationId, int $index): never
    {
        $passedPrecheck = false;
        stream_set_timeout($socket, 15);
        pcntl_signal(SIGALRM, SIG_DFL);
        pcntl_alarm(20);

        try {
            DB::purge('pgsql');
            DB::statement("SET statement_timeout = '10s'");
            DB::listen(function (QueryExecuted $query) use ($socket, &$passedPrecheck): void {
                if ($passedPrecheck || ! str_starts_with($query->sql, 'select exists(')
                    || ! in_array('courier@example.com', $query->bindings, true)
                    || ! in_array('courier', $query->bindings, true)) {
                    return;
                }
                $passedPrecheck = true;
                fwrite($socket, "ready\n");
                if (fread($socket, 1) !== '1') {
                    throw new RuntimeException('Registration precheck barrier timed out.');
                }
            });
            $email = $index === 0 ? '  COURIER@EXAMPLE.COM  ' : 'courier@example.com';
            $response = $this->postJson('/api/v1/courier/auth/register', $this->registrationPayload($organizationId, $email));
            $result = ['status' => $response->status(), 'body' => $response->json(),
                'organization_id' => $organizationId, 'passed_precheck' => $passedPrecheck];
        } catch (Throwable $exception) {
            $result = ['status' => 500, 'error_type' => $exception::class, 'passed_precheck' => $passedPrecheck];
        }

        fwrite($socket, json_encode($result, JSON_THROW_ON_ERROR)."\n");
        fclose($socket);
        DB::disconnect('pgsql');
        exit(0);
    }
}
