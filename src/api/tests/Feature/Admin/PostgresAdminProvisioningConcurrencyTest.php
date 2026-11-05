<?php

namespace Tests\Feature\Admin;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AdminRole;
use App\Models\Permission;
use App\Models\TransactionalEmail;
use App\Models\User;
use App\Services\Admin\Provisioning\AdminProvisioningService;
use App\Services\Admin\Provisioning\AdminRoleService;
use App\Services\Admin\Provisioning\AdminSetupService;
use Database\Seeders\AdminPermissionSeeder;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Tests\TestCase;

class PostgresAdminProvisioningConcurrencyTest extends TestCase
{
    use DatabaseMigrations { runDatabaseMigrations as private migrateAdminDatabase; }

    public function runDatabaseMigrations(): void
    {
        $database = (string) config('database.connections.pgsql.database');
        if (DB::getDriverName() !== 'pgsql' || ! str_starts_with($database, 'aisley_admin_provisioning_verify_')
            || getenv('ADMIN_PROVISIONING_TEST_DATABASE') !== $database || ! extension_loaded('pcntl')) {
            $this->markTestSkipped('Requires an explicitly named disposable Admin provisioning PostgreSQL database and pcntl.');
        }
        $this->migrateAdminDatabase();
        $this->seed(AdminPermissionSeeder::class);
    }

    public function test_competing_setup_completions_consume_the_code_once(): void
    {
        $admin = $this->admin();
        $admin->forceFill(['admin_setup_required' => true, 'admin_email_verification_required' => true])->save();
        $data = ['current_password' => 'Manager123', 'password' => 'Replacement456'];
        $challenge = app(AdminSetupService::class)->request($admin, $data);
        $data += ['challenge_id' => $challenge['challenge_id'], 'verification_code' => TransactionalEmail::latest()->first()->payload['code']];
        $status = $this->race('users',
            fn () => User::whereKey($admin->id)->lockForUpdate()->firstOrFail(),
            fn () => app(AdminSetupService::class)->complete($admin, $data),
            fn () => app(AdminSetupService::class)->complete($admin, $data));
        $this->assertSame(409, $status);
        $admin->refresh();
        $this->assertFalse($admin->requiresAdminSetup());
        $this->assertSame(1, $admin->admin_session_version);
        $this->assertTrue(Hash::check('Replacement456', $admin->password));
        $this->assertDatabaseCount('admin_setup_challenges', 1);
    }

    public function test_revocation_wins_over_waiting_account_creation(): void
    {
        $super = $this->admin(true);
        $manager = $this->admin();
        $manager->permissions()->sync(Permission::whereIn('slug', ['admin-accounts.view', 'admin-accounts.create', 'finance.view'])->pluck('id'));
        $create = ['email' => 'child@example.com', 'first_name' => 'Child', 'last_name' => 'Admin', 'password' => 'Temporary123',
            'current_password' => 'Manager123', 'permissions' => ['finance.view'], 'role_ids' => []];
        $update = ['email' => $manager->email, 'first_name' => 'Manager', 'last_name' => 'Admin', 'revision' => 0,
            'current_password' => 'Manager123', 'permissions' => ['admin-accounts.create'], 'role_ids' => []];
        $status = $this->race('admin_authority_locks',
            fn () => DB::table('admin_authority_locks')->where('id', 1)->lockForUpdate()->first(),
            fn () => app(AdminProvisioningService::class)->update($super, $manager, $update),
            fn () => app(AdminProvisioningService::class)->create($manager, $create));
        $this->assertSame(403, $status);
        $this->assertDatabaseMissing('users', ['email' => 'child@example.com']);
        $this->assertFalse($manager->refresh()->hasAdminPermission('finance.view'));
    }

    public function test_role_revision_prevents_concurrent_overwrite(): void
    {
        $first = $this->admin(true);
        $second = $this->admin(true);
        $role = AdminRole::create(['name' => 'Original']);
        $data = ['name' => 'Winner', 'permissions' => ['finance.view'], 'revision' => 0, 'current_password' => 'Manager123'];
        $status = $this->race('admin_authority_locks',
            fn () => DB::table('admin_authority_locks')->where('id', 1)->lockForUpdate()->first(),
            fn () => app(AdminRoleService::class)->save($first, $data, $role),
            fn () => app(AdminRoleService::class)->save($second, [...$data, 'name' => 'Loser'], $role));
        $this->assertSame(409, $status);
        $this->assertSame('Winner', $role->refresh()->name);
        $this->assertSame(1, (int) $role->revision);
    }

    private function race(string $table, \Closure $lock, \Closure $winner, \Closure $loser): int
    {
        $sockets = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, 0);
        $this->assertIsArray($sockets);
        DB::disconnect();
        $pid = pcntl_fork();
        $this->assertNotSame(-1, $pid);
        if ($pid === 0) {
            fclose($sockets[0]);
            pcntl_signal(SIGALRM, SIG_DFL);
            pcntl_alarm(25);
            stream_set_timeout($sockets[1], 20);
            try {
                DB::purge();
                DB::statement("SET statement_timeout = '15s'");
                if (fread($sockets[1], 1) !== '1') {
                    throw new \RuntimeException('Barrier timed out.');
                }
                $backend = DB::selectOne('SELECT pg_backend_pid() AS pid')->pid;
                DB::connection()->beforeExecuting(function (string $sql) use ($sockets, $backend, $table): void {
                    if (str_contains($sql, '"'.$table.'"') && str_contains($sql, 'for update')) {
                        fwrite($sockets[1], $backend."\n");
                    }
                });
                try {
                    $loser();
                    $status = 200;
                } catch (HttpExceptionInterface $error) {
                    $status = $error->getStatusCode();
                }
            } catch (\Throwable) {
                $status = 500;
            }
            fwrite($sockets[1], 'result:'.$status."\n");
            fclose($sockets[1]);
            DB::disconnect();
            exit(0);
        }
        fclose($sockets[1]);
        stream_set_timeout($sockets[0], 20);
        try {
            DB::reconnect();
            DB::statement("SET statement_timeout = '15s'");
            DB::beginTransaction();
            $lock();
            fwrite($sockets[0], '1');
            $backend = (int) fgets($sockets[0]);
            $deadline = microtime(true) + 5;
            do {
                DB::select('SELECT pg_stat_clear_snapshot()');
                $waiting = DB::selectOne('SELECT wait_event_type FROM pg_stat_activity WHERE pid = ?', [$backend]);
                if (($waiting->wait_event_type ?? null) === 'Lock') {
                    break;
                }
                usleep(10000);
            } while (microtime(true) < $deadline);
            $this->assertSame('Lock', $waiting->wait_event_type ?? null, 'Competing mutation did not wait for its lock.');
            $winner();
            DB::commit();
            do {
                $line = fgets($sockets[0]);
            } while ($line !== false && ! str_starts_with($line, 'result:'));
            $this->assertIsString($line);
            pcntl_waitpid($pid, $exit);
            $this->assertSame(0, pcntl_wexitstatus($exit));

            return (int) substr($line, 7);
        } finally {
            if (DB::transactionLevel()) {
                DB::rollBack();
            }
            fclose($sockets[0]);
        }
    }

    private function admin(bool $super = false): User
    {
        $user = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active, 'password' => 'Manager123']);
        $user->forceFill(['is_super_admin' => $super])->save();

        return $user->refresh();
    }
}
