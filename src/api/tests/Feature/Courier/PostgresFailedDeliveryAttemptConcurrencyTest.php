<?php

namespace Tests\Feature\Courier;

use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\DeliveryTask;
use App\Models\FinalMileFailedAttempt;
use App\Models\Shipment;
use App\Models\User;
use App\Services\Courier\FailedDeliveryAttemptService;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\FailedAttemptFixtures;
use Tests\TestCase;

class PostgresFailedDeliveryAttemptConcurrencyTest extends TestCase
{
    use DatabaseMigrations { runDatabaseMigrations as private migrateAttemptDatabase; }
    use FailedAttemptFixtures;

    public function runDatabaseMigrations(): void
    {
        $database = (string) config('database.connections.pgsql.database');
        if (DB::getDriverName() !== 'pgsql' || ! str_contains($database, '_failed_attempt_verify_')
            || getenv('FAILED_ATTEMPT_CONCURRENCY_TEST_DB') !== $database || ! extension_loaded('pcntl')) {
            $this->markTestSkipped('Requires an explicitly named disposable failed-attempt PostgreSQL database and pcntl.');
        }
        $this->migrateAttemptDatabase();
    }

    #[DataProvider('races')]
    public function test_requests_that_miss_the_replay_precheck_resolve_under_real_contention(
        bool $differentTask, bool $differentPayload, bool $advanceRevision,
    ): void {
        [$courier, $task] = $this->failedAttemptTask();
        $secondTask = $differentTask ? $this->anotherFailedAttemptTask($task) : $task;
        $firstState = $this->attemptState($task);
        $secondState = $this->attemptState($secondTask);
        $key = (string) Str::uuid();
        $input = $this->attemptInput();
        $secondInput = $differentPayload ? [...$input, 'note' => 'A different visit.'] : $input;
        $sockets = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, 0);
        $this->assertIsArray($sockets);
        DB::purge();
        $pid = pcntl_fork();
        $this->assertNotSame(-1, $pid);

        if ($pid === 0) {
            fclose($sockets[0]);
            pcntl_signal(SIGALRM, SIG_DFL);
            pcntl_alarm(20);
            stream_set_timeout($sockets[1], 15);
            try {
                DB::purge();
                DB::statement("SET statement_timeout = '10s'");
                if (fread($sockets[1], 1) !== '1') {
                    throw new \RuntimeException('Attempt barrier timed out.');
                }
                $backendPid = DB::selectOne('SELECT pg_backend_pid() AS pid')->pid;
                $announced = false;
                DB::connection()->beforeExecuting(function (string $sql) use ($sockets, $backendPid, $differentTask, &$announced): void {
                    $target = $differentTask
                        ? str_starts_with($sql, 'insert into "final_mile_failed_attempts"')
                        : str_contains($sql, '"shipments"') && str_contains($sql, 'for update');
                    if ($target && ! $announced) {
                        $announced = true;
                        fwrite($sockets[1], $backendPid."\n");
                    }
                });
                $result = $this->recordAttempt(User::findOrFail($courier->id), $secondTask, $secondInput, $key);
            } catch (\Throwable $error) {
                $result = ['status' => 500, 'error_type' => $error::class];
            }
            fwrite($sockets[1], json_encode($result, JSON_THROW_ON_ERROR)."\n");
            fclose($sockets[1]);
            DB::disconnect();
            exit(0);
        }

        fclose($sockets[1]);
        stream_set_timeout($sockets[0], 15);
        try {
            DB::statement("SET statement_timeout = '10s'");
            DB::beginTransaction();
            if ($differentTask) {
                // The competing transaction cannot see this row, but its insert
                // must wait for this transaction's unique-key decision.
                $first = $this->recordAttempt($courier, $task, $input, $key);
            } else {
                Shipment::whereKey($task->shipment_id)->lockForUpdate()->firstOrFail();
            }
            fwrite($sockets[0], '1');
            $backendPid = (int) fgets($sockets[0]);
            $this->assertGreaterThan(0, $backendPid);
            $this->assertWorkerBlocked($backendPid);
            if (! $differentTask) {
                $first = $this->recordAttempt($courier, $task, $input, $key);
            }
            if ($advanceRevision) {
                DeliveryTask::whereKey($task->id)->update(['revision' => 6]);
                $firstState = $secondState = $this->attemptState($task);
            }
            DB::commit();
            $line = fgets($sockets[0]);
            $this->assertIsString($line);
            $second = json_decode($line, true, flags: JSON_THROW_ON_ERROR);
            $this->assertSame(201, $first['status']);
            if ($differentTask || $differentPayload) {
                $this->assertSame(409, $second['status'], json_encode($second));
                $this->assertSame('IDEMPOTENCY_KEY_REUSED', $second['code']);
            } else {
                $this->assertSame($first, $second, json_encode($second));
            }
        } finally {
            while (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            fclose($sockets[0]);
            pcntl_waitpid($pid, $status);
            DB::purge();
        }
        $this->assertTrue(pcntl_wifexited($status));
        $this->assertSame(0, pcntl_wexitstatus($status));
        $this->assertDatabaseCount('final_mile_failed_attempts', 1);
        $stored = FinalMileFailedAttempt::sole()->toArray();
        ksort($stored);
        $this->assertSame($first['data'], $stored);
        $this->assertSame($firstState, $this->attemptState($task));
        $this->assertSame($secondState, $this->attemptState($secondTask));
    }

    public static function races(): iterable
    {
        yield 'exact replay after task lock' => [false, false, false];
        yield 'changed payload after task lock' => [false, true, false];
        yield 'different tasks collide on Courier key' => [true, false, false];
        yield 'replay precedes stale revision check' => [false, false, true];
    }

    private function recordAttempt(User $courier, DeliveryTask $task, array $input, string $key): array
    {
        try {
            $attempt = app(FailedDeliveryAttemptService::class)->record($courier, $task->id, $input, $key);
            $data = $attempt->toArray();
            ksort($data);

            return ['status' => 201, 'data' => $data];
        } catch (FulfillmentException $error) {
            return ['status' => $error->status, 'code' => $error->errorCode];
        }
    }

    private function assertWorkerBlocked(int $backendPid): void
    {
        $deadline = microtime(true) + 5;
        do {
            DB::select('SELECT pg_stat_clear_snapshot()');
            $activity = DB::selectOne('SELECT wait_event_type FROM pg_stat_activity WHERE pid = ?', [$backendPid]);
            if (($activity->wait_event_type ?? null) === 'Lock') {
                break;
            }
            usleep(10000);
        } while (microtime(true) < $deadline);
        $this->assertSame('Lock', $activity->wait_event_type ?? null, 'Competing request did not block after its empty replay precheck.');
    }
}
