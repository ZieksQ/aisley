<?php

namespace Tests\Feature\Logistics;

use App\Models\Shipment;
use App\Models\SortingPlan;
use App\Models\SortingPlanActivation;
use App\Models\SortingSession;
use App\Models\User;
use App\Services\Logistics\Sorting\SortingVersionService;
use App\Services\Logistics\SortingService;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\LocalSortingFixtures;
use Tests\TestCase;

class SortingConcurrencyTest extends TestCase
{
    use DatabaseMigrations { runDatabaseMigrations as private migrateSortingDatabase; }
    use LocalSortingFixtures;

    public function runDatabaseMigrations(): void
    {
        if (DB::getDriverName() !== 'pgsql' || ! extension_loaded('pcntl')) {
            $this->markTestSkipped('Requires disposable PostgreSQL and independent pcntl workers.');
        }
        $this->migrateSortingDatabase();
        config(['hub-routing.enabled' => false]);
    }

    private function setupSorting(): array
    {
        [$actor] = $this->receivedParcels(1);
        $lane = $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'LANE-1', 'name' => 'Lane one', 'type' => 'standard'])->assertCreated()->json('data');
        $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'EX', 'name' => 'Exceptions', 'type' => 'exception'])->assertCreated();
        $plan = $this->postJson('/api/v1/logistics/sorting/plans', ['name' => 'First plan'])->assertCreated()->json('data');
        $this->postJson('/api/v1/logistics/sorting/plans/'.$plan['id'].'/lanes', ['expected_revision' => 1, 'lane_id' => $lane['id'], 'postal_code' => '6000'])->assertOk();
        $first = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/plans/'.$plan['id'].'/actions/publish', ['expected_revision' => 2, 'activate' => true])->assertOk()->json('data.version');
        $session = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/sessions')->assertCreated()->json('data');
        $capture = ['client_id' => (string) Str::uuid(), 'auto_route' => true, 'reference' => $session['items'][0]['reference'], 'expected_revision' => $session['items'][0]['expected_revision'], 'source' => 'barcode', 'captured_at' => now()->toISOString()];

        return [$actor, $plan, $first, $session, $capture];
    }

    public function test_activation_and_scan_race_keeps_one_consistent_frozen_assignment(): void
    {
        [$actor, $plan, $first, $session, $capture] = $this->setupSorting();
        $lane = $this->postJson('/api/v1/logistics/sorting/lanes', ['code' => 'LANE-5', 'name' => 'Lane five', 'type' => 'standard'])->assertCreated()->json('data');
        $next = $this->postJson('/api/v1/logistics/sorting/plans', ['name' => 'Second plan'])->assertCreated()->json('data');
        $this->postJson('/api/v1/logistics/sorting/plans/'.$next['id'].'/lanes', ['expected_revision' => 1, 'lane_id' => $lane['id'], 'postal_code' => '6000'])->assertOk();
        $second = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/plans/'.$next['id'].'/actions/publish', ['expected_revision' => 2])->assertOk()->json('data.version');
        $jobs = [
            ['kind' => 'capture', 'session_id' => $session['id'], 'input' => $capture],
            ['kind' => 'activate', 'plan_id' => $next['id'], 'input' => ['expected_revision' => 3, 'version_id' => $second['id']], 'key' => (string) Str::uuid()],
        ];
        $results = $this->workers($actor->id, $jobs);
        $this->assertSame([200, 200], array_column($results, 'status'), json_encode($results));
        $assignment = Shipment::sole()->sorting_assignment;
        $this->assertContains($assignment['version_id'], [$first['id'], $second['id']]);
        $this->assertSame($assignment['version_id'] === $first['id'] ? 'LANE-1' : 'LANE-5', $assignment['lane']['code']);
        $this->assertSame(1, SortingPlan::where('is_active', true)->count());
        $this->assertDatabaseCount('sorting_scans', 1);
        $this->assertSame($results[0]['result'], app(SortingService::class)->processCapture($actor, SortingSession::find($session['id']), $capture));
    }

    public function test_concurrent_scan_retries_replay_the_same_result_once(): void
    {
        [$actor, , , $session, $capture] = $this->setupSorting();
        $job = ['kind' => 'capture', 'session_id' => $session['id'], 'input' => $capture];
        $results = $this->workers($actor->id, [$job, $job]);
        $this->assertSame([200, 200], array_column($results, 'status'), json_encode($results));
        $this->assertSame($results[0]['result'], $results[1]['result']);
        $this->assertDatabaseCount('sorting_scans', 1);
        $this->assertSame(1, DB::table('shipment_events')->where('event_type', 'hub_sort')->count());
    }

    public function test_duplicate_activation_mutations_record_one_outcome(): void
    {
        [$actor, $plan, $version] = $this->setupSorting();
        $before = SortingPlanActivation::count();
        $job = ['kind' => 'activate', 'plan_id' => $plan['id'], 'input' => ['expected_revision' => SortingPlan::find($plan['id'])->revision, 'version_id' => $version['id']], 'key' => (string) Str::uuid()];
        $results = $this->workers($actor->id, [$job, $job]);
        $this->assertSame([200, 200], array_column($results, 'status'), json_encode($results));
        $this->assertSame($results[0]['result'], $results[1]['result']);
        $this->assertSame($before + 1, SortingPlanActivation::count());
    }

    private function workers(string $actorId, array $jobs): array
    {
        $start = storage_path('framework/testing/sorting-'.Str::uuid().'.start');
        if (! is_dir(dirname($start))) {
            mkdir(dirname($start), 0775, true);
        }
        $files = [];
        $pids = [];
        DB::disconnect();
        try {
            foreach ($jobs as $job) {
                $file = storage_path('framework/testing/sorting-'.Str::uuid().'.json');
                $files[] = $file;
                $pid = pcntl_fork();
                if ($pid === -1) {
                    throw new \RuntimeException('Could not fork sorting test worker.');
                }
                if ($pid === 0) {
                    try {
                        $deadline = microtime(true) + 10;
                        while (! is_file($start) && microtime(true) < $deadline) {
                            usleep(1000);
                        }
                        DB::reconnect();
                        DB::statement("SET statement_timeout = '10s'");
                        $actor = User::findOrFail($actorId);
                        $result = $job['kind'] === 'capture'
                            ? app(SortingService::class)->processCapture($actor, SortingSession::findOrFail($job['session_id']), $job['input'])
                            : app(SortingVersionService::class)->action($actor, SortingPlan::findOrFail($job['plan_id']), 'activate', $job['input'], $job['key']);
                        $output = ['status' => 200, 'result' => $result];
                    } catch (\Throwable $e) {
                        $output = ['status' => 500, 'type' => $e::class, 'message' => $e->getMessage()];
                    }
                    file_put_contents($file, json_encode($output, JSON_THROW_ON_ERROR));
                    exit(0);
                }
                $pids[] = $pid;
            }
            file_put_contents($start, 'start');
            foreach ($pids as $pid) {
                pcntl_waitpid($pid, $status);
                $this->assertSame(0, pcntl_wexitstatus($status));
            }
            DB::reconnect();

            return array_map(fn ($file) => json_decode(file_get_contents($file), true, flags: JSON_THROW_ON_ERROR), $files);
        } finally {
            foreach ([$start, ...$files] as $file) {
                if (is_file($file)) {
                    unlink($file);
                }
            }
            DB::reconnect();
        }
    }
}
