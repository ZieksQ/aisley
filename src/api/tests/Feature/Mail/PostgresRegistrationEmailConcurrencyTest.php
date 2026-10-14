<?php

namespace Tests\Feature\Mail;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\RegistrationEmailChallenge;
use App\Models\RegistrationEmailIdentity;
use App\Models\User;
use App\Services\Auth\RegistrationEmailVerification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class PostgresRegistrationEmailConcurrencyTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $database = (string) config('database.connections.pgsql.database');
        if (DB::getDriverName() !== 'pgsql' || ! str_contains($database, '_courier_registration_verify_')
            || getenv('COURIER_REGISTRATION_CONCURRENCY_TEST_DB') !== $database || ! function_exists('pcntl_fork')) {
            $this->markTestSkipped('Requires an explicitly named disposable registration PostgreSQL database and pcntl.');
        }
        $this->artisan('migrate:fresh', ['--force' => true])->assertSuccessful();
    }

    public function test_concurrent_first_code_requests_share_one_identity_and_resend_quota(): void
    {
        $results = $this->parallel(2, fn () => app(RegistrationEmailVerification::class)->request(UserRole::Customer, 'new@example.com'));
        sort($results);
        $this->assertSame([200, 429], $results);
        $this->assertDatabaseCount('registration_email_identities', 1);
        $this->assertDatabaseCount('registration_email_challenges', 1);
        $this->assertDatabaseCount('transactional_emails', 1);
        $this->assertDatabaseCount('users', 0);
    }

    public function test_concurrent_wrong_attempts_cannot_lose_updates_or_bypass_exhaustion(): void
    {
        $challenge = $this->challenge();
        $results = $this->parallel(5, fn () => app(RegistrationEmailVerification::class)->verify(UserRole::Customer, 'new@example.com', $challenge->id, '999999'));
        $this->assertSame([422, 422, 422, 422, 422], $results);
        $this->assertSame(5, $challenge->fresh()->attempts);
        $this->assertNotNull($challenge->fresh()->invalidated_at);
        $this->assertNull($challenge->fresh()->token);
    }

    public function test_two_completions_cannot_consume_the_same_proof(): void
    {
        $challenge = $this->challenge();
        $proof = app(RegistrationEmailVerification::class)->verify(UserRole::Customer, 'new@example.com', $challenge->id, '012345');
        $results = $this->parallel(2, fn () => app(RegistrationEmailVerification::class)->complete(
            UserRole::Customer, 'new@example.com', $proof['email_verification_token'],
            fn () => User::create(['email' => 'new@example.com', 'role' => UserRole::Customer, 'status' => UserStatus::Pending, 'password' => 'SyntheticTest9']),
        ));
        sort($results);
        $this->assertSame([200, 422], $results);
        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertNotNull(User::query()->sole()->email_verified_at);
        $this->assertNotNull($challenge->fresh()->consumed_at);
    }

    private function challenge(): RegistrationEmailChallenge
    {
        $identity = RegistrationEmailIdentity::create(['email' => 'new@example.com', 'role' => UserRole::Customer]);

        return RegistrationEmailChallenge::create(['identity_id' => $identity->id, 'code_hash' => Hash::make('012345'), 'expires_at' => now()->addMinutes(10)]);
    }

    private function parallel(int $count, \Closure $action): array
    {
        $workers = [];
        DB::disconnect('pgsql');
        try {
            for ($i = 0; $i < $count; $i++) {
                $pair = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, 0);
                $this->assertIsArray($pair);
                $pid = pcntl_fork();
                $this->assertNotSame(-1, $pid);
                if ($pid === 0) {
                    fclose($pair[0]);
                    foreach ($workers as [, $socket]) {
                        fclose($socket);
                    }
                    pcntl_alarm(20);
                    DB::purge('pgsql');
                    DB::statement("SET statement_timeout = '10s'");
                    fwrite($pair[1], "ready\n");
                    fread($pair[1], 1);
                    try {
                        $action();
                        $status = 200;
                    } catch (ValidationException) {
                        $status = 422;
                    } catch (HttpException $exception) {
                        $status = $exception->getStatusCode();
                    } catch (\Throwable) {
                        $status = 500;
                    }
                    fwrite($pair[1], $status."\n");
                    fclose($pair[1]);
                    DB::disconnect('pgsql');
                    exit(0);
                }
                fclose($pair[1]);
                stream_set_timeout($pair[0], 25);
                $workers[] = [$pid, $pair[0]];
            }
            foreach ($workers as [, $socket]) {
                $this->assertSame("ready\n", fgets($socket));
            }
            foreach ($workers as [, $socket]) {
                fwrite($socket, '1');
            }

            return array_map(fn ($worker) => (int) fgets($worker[1]), $workers);
        } finally {
            foreach ($workers as [$pid, $socket]) {
                fclose($socket);
                pcntl_waitpid($pid, $status);
                $this->assertSame(0, pcntl_wexitstatus($status));
            }
            DB::purge('pgsql');
        }
    }
}
