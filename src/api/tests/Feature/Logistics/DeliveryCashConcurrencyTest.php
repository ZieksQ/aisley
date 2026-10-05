<?php

namespace Tests\Feature\Logistics;

use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\CheckoutBatch;
use App\Models\CheckoutQuote;
use App\Models\CourierCashObligation;
use App\Models\SandboxGatewayAccount;
use App\Models\ShipmentEvent;
use App\Models\User;
use App\Services\Finance\CourierCashService;
use App\Services\Fulfillment\FulfillmentTransitionService;
use App\Services\Logistics\AutomaticDeliveryApprovalService;
use App\Services\Logistics\DeliveryProofReviewService;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\Support\DeliveryReviewFixtures;
use Tests\TestCase;

class DeliveryCashConcurrencyTest extends TestCase
{
    use DatabaseMigrations {
        runDatabaseMigrations as private migrateReviewDatabase;
    }
    use DeliveryReviewFixtures;

    public function runDatabaseMigrations(): void
    {
        if (DB::getDriverName() !== 'pgsql' || ! extension_loaded('pcntl')) {
            $this->markTestSkipped('Requires isolated PostgreSQL and pcntl.');
        }
        $this->migrateReviewDatabase();
    }

    public function test_approval_and_rejection_serialize_one_decision(): void
    {
        [$logistics, $courier, $task, $proof] = $this->readyDelivery();
        $this->submitIntent($courier, $task, $proof);
        $input = ['reference' => $task->shipment->parcel->waybill->reference, 'target_state' => 'delivered', 'expected_revision' => 5, 'evidence_id' => $proof->id];
        $results = $this->workers([
            fn () => app(FulfillmentTransitionService::class)->transitionLogistics(User::findOrFail($logistics->id), $input, (string) Str::uuid()),
            fn () => app(DeliveryProofReviewService::class)->reject(User::findOrFail($logistics->id), $proof->id, 'Photo needs correction.', 5),
        ]);
        sort($results);
        $this->assertSame([200, 409], $results);
        $this->assertContains($proof->fresh()->status->value, ['validated', 'rejected']);
        $delivered = $proof->fresh()->status->value === 'validated';
        $this->assertSame($delivered ? 1 : 0, ShipmentEvent::where('event_type', 'delivery_completed')->count());
        $this->assertDatabaseCount('courier_cash_obligations', $delivered ? 1 : 0);
    }

    public function test_duplicate_receipts_and_competing_receipt_keys_credit_once(): void
    {
        config(['finance.gateway_enabled' => true]);
        [$logistics, $courier, $task, $proof] = $this->readyDelivery();
        $this->submitIntent($courier, $task, $proof);
        $this->approveDelivery($logistics, $task, $proof);
        $ids = [CourierCashObligation::sole()->id];
        $key = (string) Str::uuid();
        $results = $this->workers([
            fn () => app(CourierCashService::class)->receive(User::findOrFail($logistics->id), $ids, $key),
            fn () => app(CourierCashService::class)->receive(User::findOrFail($logistics->id), $ids, $key),
        ]);
        $this->assertSame([200, 200], $results);
        $this->assertDatabaseCount('courier_cash_receipts', 1);
        $this->assertDatabaseCount('courier_cash_credits', 1);
        $this->assertSame(10000, SandboxGatewayAccount::where('reference', 'logistics-'.$logistics->logisticsOrganization->id)->sole()->balance_cents);
        $results = $this->workers([
            fn () => app(CourierCashService::class)->receive(User::findOrFail($logistics->id), $ids, (string) Str::uuid()),
            fn () => app(CourierCashService::class)->receive(User::findOrFail($logistics->id), $ids, (string) Str::uuid()),
        ]);
        $this->assertSame([409, 409], $results);
        $this->assertDatabaseCount('courier_cash_receipts', 1);

        $second = CourierCashObligation::sole()->replicate(['order_id', 'received_at']);
        $order = $task->shipment->parcel->order->replicate();
        $batch = CheckoutBatch::findOrFail($order->checkout_batch_id)->replicate();
        $quote = CheckoutQuote::findOrFail($batch->checkout_quote_id)->replicate();
        $quote->save();
        $batch->checkout_quote_id = $quote->id;
        $batch->idempotency_key = (string) Str::uuid();
        $batch->save();
        $order->checkout_batch_id = $batch->id;
        $order->reference = 'CASH-RACE-SECOND';
        $order->save();
        $second->order_id = $order->id;
        $second->order_reference = $order->reference;
        $second->save();
        $results = $this->workers([
            fn () => app(CourierCashService::class)->receive(User::findOrFail($logistics->id), [$second->id], (string) Str::uuid()),
            fn () => app(CourierCashService::class)->receive(User::findOrFail($logistics->id), [$second->id], (string) Str::uuid()),
        ]);
        sort($results);
        $this->assertSame([200, 409], $results);
        $this->assertDatabaseCount('courier_cash_receipts', 2);
        $this->assertSame(20000, SandboxGatewayAccount::where('reference', 'logistics-'.$logistics->logisticsOrganization->id)->sole()->balance_cents);
    }

    public function test_automatic_and_manual_approval_finalize_once(): void
    {
        [$logistics, $courier, $task, $proof] = $this->readyDelivery(true);
        $logistics->logisticsOrganization->update(['delivery_approval_mode' => 'automatic']);
        $intent = $this->submitIntent($courier, $task, $proof, false);
        $input = ['reference' => $task->shipment->parcel->waybill->reference, 'target_state' => 'delivered', 'expected_revision' => 5, 'evidence_id' => $proof->id];
        $results = $this->workers([
            fn () => app(AutomaticDeliveryApprovalService::class)->approve($intent->id),
            fn () => app(FulfillmentTransitionService::class)->transitionLogistics(User::findOrFail($logistics->id), $input, (string) Str::uuid()),
        ]);
        $this->assertContains(200, $results);
        $this->assertSame('delivered', $task->fresh()->status->value);
        $this->assertSame('validated', $proof->fresh()->status->value);
        $this->assertSame(1, ShipmentEvent::where('event_type', 'delivery_completed')->count());
        $this->assertDatabaseCount('courier_cash_obligations', 0);
    }

    private function workers(array $operations): array
    {
        $start = storage_path('framework/testing/pod-'.Str::uuid().'.start');
        $files = [];
        $pids = [];
        DB::disconnect();
        try {
            foreach ($operations as $operation) {
                $file = storage_path('framework/testing/pod-'.Str::uuid().'.json');
                $files[] = $file;
                $pid = pcntl_fork();
                if ($pid === -1) {
                    throw new \RuntimeException('Unable to start concurrency worker.');
                }
                if ($pid === 0) {
                    try {
                        $deadline = microtime(true) + 10;
                        while (! is_file($start) && microtime(true) < $deadline) {
                            usleep(1000);
                        }
                        DB::reconnect();
                        DB::statement("SET statement_timeout = '10s'");
                        $operation();
                        $output = ['status' => 200];
                    } catch (FulfillmentException $error) {
                        $output = ['status' => $error->status];
                    } catch (HttpException $error) {
                        $output = ['status' => $error->getStatusCode()];
                    } catch (\Throwable $error) {
                        $output = ['status' => 500, 'message' => $error->getMessage()];
                    }
                    file_put_contents($file, json_encode($output));
                    exit(0);
                }
                $pids[] = $pid;
            }
            file_put_contents($start, 'go');
            foreach ($pids as $pid) {
                pcntl_waitpid($pid, $status);
                $this->assertSame(0, pcntl_wexitstatus($status));
            }
            DB::reconnect();
            $results = array_map(fn ($file) => json_decode(file_get_contents($file), true, flags: JSON_THROW_ON_ERROR), $files);
            $this->assertNotContains(500, array_column($results, 'status'), json_encode($results));

            return array_column($results, 'status');
        } finally {
            foreach ([...$files, $start] as $file) {
                if (is_file($file)) {
                    unlink($file);
                }
            }
            DB::reconnect();
        }
    }
}
