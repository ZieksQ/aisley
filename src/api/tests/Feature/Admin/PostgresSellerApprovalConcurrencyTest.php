<?php

namespace Tests\Feature\Admin;

use App\Enums\ApplicationStatus;
use App\Enums\DocumentStatus;
use App\Enums\ShopStatus;
use App\Enums\UserStatus;
use App\Models\RegistrationApplication;
use App\Models\User;
use App\Notifications\Admin\RegistrationDecisionNotification;
use App\Services\Admin\RegistrationReviewService;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Tests\Support\SellerApprovalFixtures;
use Tests\TestCase;

class PostgresSellerApprovalConcurrencyTest extends TestCase
{
    use DatabaseMigrations { runDatabaseMigrations as private migrateApprovalDatabase; }
    use SellerApprovalFixtures;

    public function runDatabaseMigrations(): void
    {
        $database = (string) config('database.connections.pgsql.database');
        if (DB::getDriverName() !== 'pgsql' || ! str_contains($database, '_seller_approval_verify_')
            || getenv('SELLER_APPROVAL_CONCURRENCY_TEST_DB') !== $database || ! extension_loaded('pcntl')) {
            $this->markTestSkipped('Requires an explicitly named disposable Seller-approval PostgreSQL database and pcntl.');
        }
        $this->migrateApprovalDatabase();
    }

    #[DataProvider('decisions')]
    public function test_only_one_review_commits_under_real_lock_contention(string $winner, string $loser): void
    {
        Notification::fake();
        $application = $this->pendingSeller();
        $shop = $this->sellerApprovalEvidence($application);
        $firstAdmin = $this->reviewer();
        $secondAdmin = $this->reviewer();
        $sockets = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, 0);
        $this->assertIsArray($sockets);
        DB::disconnect();
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
                    throw new \RuntimeException('Review barrier timed out.');
                }
                $backendPid = DB::selectOne('SELECT pg_backend_pid() AS pid')->pid;
                DB::connection()->beforeExecuting(function (string $sql) use ($sockets, $backendPid): void {
                    if (str_contains($sql, '"registration_applications"') && str_contains($sql, 'for update')) {
                        fwrite($sockets[1], $backendPid."\n");
                    }
                });
                $result = $this->decide($application, $secondAdmin, $loser);
            } catch (\Throwable $exception) {
                $result = ['status' => 500, 'error_type' => $exception::class];
            }
            fwrite($sockets[1], json_encode($result, JSON_THROW_ON_ERROR)."\n");
            fclose($sockets[1]);
            DB::disconnect();
            exit(0);
        }

        fclose($sockets[1]);
        stream_set_timeout($sockets[0], 15);
        try {
            DB::reconnect();
            DB::statement("SET statement_timeout = '10s'");
            DB::beginTransaction();
            RegistrationApplication::whereKey($application->id)->lockForUpdate()->firstOrFail();
            fwrite($sockets[0], '1');
            $backendPid = (int) fgets($sockets[0]);
            $deadline = microtime(true) + 5;
            do {
                DB::select('SELECT pg_stat_clear_snapshot()');
                $waiting = DB::selectOne('SELECT wait_event_type FROM pg_stat_activity WHERE pid = ?', [$backendPid]);
                if (($waiting->wait_event_type ?? null) === 'Lock') {
                    break;
                }
                usleep(10000);
            } while (microtime(true) < $deadline);
            $this->assertSame('Lock', $waiting->wait_event_type ?? null, 'Competing review did not block on the application lock.');
            $firstResult = $this->decide($application, $firstAdmin, $winner);
            DB::commit();
            $line = fgets($sockets[0]);
            $this->assertIsString($line);
            $secondResult = json_decode($line, true, flags: JSON_THROW_ON_ERROR);
            $this->assertSame(200, $firstResult['status']);
            $this->assertSame(409, $secondResult['status'], json_encode($secondResult));
            $this->assertSame(1, $firstResult['notifications'] + $secondResult['notifications']);
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
        $this->assertSame(ApplicationStatus::from($winner), $application->fresh()->status);
        $this->assertSame($firstAdmin->id, $application->fresh()->reviewer_id);
        $this->assertSame($winner === 'approved' ? UserStatus::Active : UserStatus::Rejected, $application->user->fresh()->status);
        $this->assertSame($winner === 'approved' ? ShopStatus::Active : ShopStatus::Deactivated, $shop->fresh()->status);
        foreach ($application->documents()->get() as $document) {
            $this->assertSame($winner === 'approved' ? DocumentStatus::Verified : DocumentStatus::Rejected, $document->status);
            $this->assertSame($firstAdmin->id, $document->reviewer_id);
        }
        $this->assertDatabaseCount('audit_logs', 1);
        $this->assertDatabaseCount('audit_outbox', 1);
    }

    public static function decisions(): iterable
    {
        yield 'approve versus approve' => ['approved', 'approved'];
        yield 'approve versus reject' => ['approved', 'rejected'];
        yield 'reject versus approve' => ['rejected', 'approved'];
    }

    /** @return array{status: int, notifications: int} */
    private function decide(RegistrationApplication $application, User $admin, string $decision): array
    {
        $status = 200;
        try {
            app(RegistrationReviewService::class)->decide($application, $admin, ApplicationStatus::from($decision), null, null, null);
        } catch (HttpExceptionInterface $exception) {
            $status = $exception->getStatusCode();
        }

        return ['status' => $status, 'notifications' => Notification::sent($application->user, RegistrationDecisionNotification::class)->count()];
    }
}
