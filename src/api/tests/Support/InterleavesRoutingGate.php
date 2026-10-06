<?php

namespace Tests\Support;

use App\Models\Permission;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

trait InterleavesRoutingGate
{
    /** Hold the gate until an independent workflow requests it, then run the competing operation. */
    private function interleaveRoutingGate(callable $worker, callable $gateOwner): array
    {
        $prefix = storage_path('framework/testing/pickup-routing-'.Str::uuid());
        if (! is_dir(dirname($prefix))) {
            mkdir(dirname($prefix), 0775, true);
        }
        DB::disconnect();
        $pid = pcntl_fork();
        if ($pid === -1) {
            throw new \RuntimeException('Unable to create routing concurrency worker.');
        }
        if ($pid === 0) {
            try {
                pcntl_alarm(20);
                $this->waitForRoutingWorker($prefix.'.gate');
                DB::reconnect();
                DB::statement("SET statement_timeout = '10s'");
                DB::connection()->beforeExecuting(function (string $query, array $bindings) use ($prefix): void {
                    if (str_contains($query, '"permissions"') && str_contains($query, 'for update') && in_array('platform-settings.manage', $bindings, true)) {
                        file_put_contents($prefix.'.waiting', 'waiting for routing gate');
                    }
                });
                // Expose a deadlock directly instead of allowing nested workflow retries to hide it.
                $result = DB::transaction($worker);
                $output = ['status' => 200, 'result' => $result];
            } catch (\Throwable $exception) {
                $output = ['status' => 500, 'type' => $exception::class, 'message' => $exception->getMessage()];
            }
            file_put_contents($prefix.'.result', json_encode($output, JSON_THROW_ON_ERROR));
            DB::disconnect();
            exit(0);
        }

        $reaped = false;
        try {
            DB::reconnect();
            DB::statement("SET statement_timeout = '10s'");
            DB::transaction(function () use ($prefix, $gateOwner): void {
                Permission::query()->where('slug', 'platform-settings.manage')->lockForUpdate()->firstOrFail();
                file_put_contents($prefix.'.gate', 'owner has routing gate');
                $this->waitForRoutingWorker($prefix.'.waiting');
                $gateOwner();
            });
            pcntl_waitpid($pid, $status);
            $reaped = true;
            $this->assertTrue(pcntl_wifexited($status), 'Routing worker exceeded its deadline.');
            $this->assertSame(0, pcntl_wexitstatus($status));
            $output = json_decode(file_get_contents($prefix.'.result'), true, flags: JSON_THROW_ON_ERROR);
            $this->assertSame(200, $output['status'], json_encode($output));

            return $output['result'];
        } finally {
            if (! $reaped) {
                pcntl_waitpid($pid, $status);
            }
            foreach (['.gate', '.waiting', '.result'] as $suffix) {
                if (is_file($prefix.$suffix)) {
                    unlink($prefix.$suffix);
                }
            }
            DB::disconnect();
            DB::reconnect();
        }
    }

    private function waitForRoutingWorker(string $path): void
    {
        $deadline = microtime(true) + 5;
        while (! is_file($path)) {
            if (microtime(true) >= $deadline) {
                throw new \RuntimeException('Routing worker did not reach its synchronization point.');
            }
            usleep(1000);
            clearstatcache(true, $path);
        }
    }
}
