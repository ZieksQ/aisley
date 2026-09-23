<?php

namespace Tests\Feature\Logistics;

use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\LinehaulTrip;
use App\Models\Shipment;
use App\Models\ShipmentEvent;
use App\Models\User;
use App\Services\Logistics\LinehaulReceivingService;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\Support\LinehaulReceivingFixtures;
use Tests\TestCase;

class LinehaulReceivingConcurrencyTest extends TestCase
{
    use DatabaseMigrations {
        runDatabaseMigrations as private migrateReceivingDatabase;
    }
    use LinehaulReceivingFixtures;

    public function runDatabaseMigrations(): void
    {
        if (DB::getDriverName() !== 'pgsql' || ! extension_loaded('pcntl')) {
            $this->markTestSkipped('Requires isolated PostgreSQL and pcntl worker processes.');
        }
        $this->migrateReceivingDatabase();
    }

    public function test_independent_scanners_and_closure_serialize_without_duplicate_custody(): void
    {
        config(['services.geoapify.server_key' => 'test-key']);
        Http::fake(['*' => Http::response(['sources_to_targets' => [[['distance' => 1000, 'time' => 100]]]])]);
        [$a, $b, $trip, $references] = $this->receivingLoad();
        $service = app(LinehaulReceivingService::class);
        $service->start($b[0], $trip['id'], ['client_id' => (string) Str::uuid()]);
        $capture = $this->captureInput($references[0]);
        $replays = $this->workers($b[0]->id, $trip['id'], [['batch', [$capture]], ['batch', [$capture]]]);
        $this->assertSame([200, 200], array_column($replays, 'status'), json_encode($replays));
        $this->assertSame($replays[0]['result']['results'], $replays[1]['result']['results']);
        $differentDevices = $this->workers($b[0]->id, $trip['id'], [['batch', [$this->captureInput($references[1])]], ['batch', [$this->captureInput($references[1])]]]);
        $this->assertSame([200, 200], array_column($differentDevices, 'status'), json_encode($differentDevices));
        $this->assertSame($differentDevices[0]['result']['results'][0]['receipt_id'], $differentDevices[1]['result']['results'][0]['receipt_id']);
        $closure = $this->workers($b[0]->id, $trip['id'], [
            ['batch', [$this->captureInput($references[2])]],
            ['finish', ['client_id' => (string) Str::uuid(), 'acknowledge_shortages' => true, 'reason' => 'Dock checked; close with any remaining shortages.']],
        ]);
        $this->assertSame([200, 200], array_column($closure, 'status'), json_encode($closure));
        $this->assertSame(3, ShipmentEvent::where('event_type', 'hub_transfer_received')->count());
        $this->assertSame(3, Shipment::where('current_hub_id', $b[2]->id)->where('status', 'received_at_hub')->count());
        $this->assertDatabaseCount('linehaul_receipts', 3);
        $this->assertSame(0, DB::table('linehaul_discrepancies')->where('kind', 'missing')->whereNull('resolved_at')->count());
        $this->assertNotNull(LinehaulTrip::findOrFail($trip['id'])->unloading_closed_at);
    }

    private function workers(string $actorId, string $tripId, array $operations): array
    {
        $startFile = storage_path('framework/testing/linehaul-receiving-'.Str::uuid().'.start');
        $files = [$startFile];
        $resultFiles = [];
        $pids = [];
        DB::disconnect(); // Forks must never share a libpq connection/socket.
        try {
            foreach ($operations as [$method, $input]) {
                $file = storage_path('framework/testing/linehaul-receiving-'.Str::uuid().'.json');
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
                        $result = app(LinehaulReceivingService::class)->{$method}(User::findOrFail($actorId), $tripId, $input);
                        $output = ['status' => 200, 'result' => $result];
                    } catch (FulfillmentException $exception) {
                        $output = ['status' => $exception->status, 'code' => $exception->errorCode];
                    } catch (\Throwable $exception) {
                        $output = ['status' => 500, 'error_type' => $exception::class, 'message' => $exception->getMessage()];
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
