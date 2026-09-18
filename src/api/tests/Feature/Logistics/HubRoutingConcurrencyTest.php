<?php

namespace Tests\Feature\Logistics;

use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\Shipment;
use App\Models\ShipmentEvent;
use App\Models\User;
use App\Services\Fulfillment\FulfillmentTransitionService;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\Support\HubRoutingFixtures;
use Tests\TestCase;

class HubRoutingConcurrencyTest extends TestCase
{
    use DatabaseMigrations {
        runDatabaseMigrations as private migrateRoutingDatabase;
    }
    use HubRoutingFixtures;

    public function runDatabaseMigrations(): void
    {
        if (DB::getDriverName() !== 'pgsql' || ! extension_loaded('pcntl')) {
            $this->markTestSkipped('Requires isolated PostgreSQL and pcntl worker processes.');
        }
        $this->migrateRoutingDatabase();
    }

    public function test_postgres_serializes_duplicate_departures_and_competing_arrivals(): void
    {
        if (DB::getDriverName() !== 'pgsql' || ! extension_loaded('pcntl')) {
            $this->markTestSkipped('Requires isolated PostgreSQL and pcntl worker processes.');
        }
        config(['hub-routing.enabled' => true, 'services.geoapify.server_key' => 'test-key']);
        Http::fake(['*' => Http::response(['sources_to_targets' => [[['distance' => 100, 'time' => 10]]]])]);
        $a = $this->pinnedHub();
        $b = $this->pinnedHub();
        $this->edge($a[2], $b[2]);
        $this->area($b[2]);
        [, $reference] = $this->pickupAt($a);
        $this->receiveOrigin($a, $reference);
        $record = $this->sortFor($a, $reference, $b[2]->id);
        $hop = $record['route']['hops'][0];
        $input = ['reference' => $reference, 'hop_id' => $hop['id'], 'expected_revision' => $record['revision'], 'expected_hop_revision' => $hop['revision']];
        $key = (string) Str::uuid();
        $departures = $this->workers($a[0]->id, $input, [$key, $key], false);
        $this->assertSame([200, 200], array_column($departures, 'status'));
        $this->assertSame($departures[0]['result'], $departures[1]['result']);
        $this->assertSame(1, ShipmentEvent::where('event_type', 'hub_transfer_dispatched')->count());
        $departure = $departures[0]['result'];
        $input['expected_revision'] = $departure['revision'];
        $input['expected_hop_revision'] = $departure['route']['hops'][0]['revision'];
        $arrivals = $this->workers($b[0]->id, $input, [(string) Str::uuid(), (string) Str::uuid()], true);
        $statuses = array_column($arrivals, 'status');
        sort($statuses);
        $this->assertSame([200, 404], $statuses);
        $this->assertSame(1, ShipmentEvent::where('event_type', 'hub_transfer_received')->count());
        $this->assertSame($b[2]->id, Shipment::sole()->current_hub_id);
        $this->assertSame('received_at_hub', Shipment::sole()->status->value);
    }

    private function workers(string $actorId, array $input, array $keys, bool $arrival): array
    {
        $startFile = storage_path('framework/testing/hub-routing-'.Str::uuid().'.start');
        $files = [$startFile];
        $resultFiles = [];
        $pids = [];
        DB::disconnect(); // Forks must never share a libpq connection/socket.
        try {
            foreach ($keys as $key) {
                $file = storage_path('framework/testing/hub-routing-'.Str::uuid().'.json');
                if (! is_dir(dirname($file))) {
                    mkdir(dirname($file), 0775, true);
                }
                $files[] = $file;
                $resultFiles[] = $file;
                $pid = pcntl_fork();
                if ($pid === -1) {
                    throw new \RuntimeException('Unable to start custody test worker.');
                }
                if ($pid === 0) {
                    try {
                        $deadline = microtime(true) + 10;
                        while (! is_file($startFile) && microtime(true) < $deadline) {
                            usleep(1000);
                        }
                        DB::reconnect();
                        DB::statement("SET statement_timeout = '10s'");
                        $result = app(FulfillmentTransitionService::class)->transferAtHub(User::findOrFail($actorId), $input, $key, $arrival);
                        $output = ['status' => 200, 'result' => $result];
                    } catch (FulfillmentException $exception) {
                        $output = ['status' => $exception->status, 'code' => $exception->errorCode];
                    } catch (\Throwable $exception) {
                        $output = ['status' => 500, 'error_type' => $exception::class];
                    }
                    file_put_contents($file, json_encode($output, JSON_THROW_ON_ERROR));
                    exit(0);
                }
                $pids[] = $pid;
            }
            file_put_contents($startFile, 'start');
            foreach ($pids as $pid) {
                pcntl_waitpid($pid, $status);
                $this->assertSame(0, pcntl_wexitstatus($status));
            }
            DB::reconnect();

            return array_map(fn ($file) => json_decode(file_get_contents($file), true, flags: JSON_THROW_ON_ERROR), $resultFiles);
        } finally {
            foreach ($files as $file) {
                if (is_file($file)) {
                    unlink($file);
                }
            }
            DB::reconnect();
        }
    }
}
