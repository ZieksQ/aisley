<?php

namespace Tests\Feature\Orders;

use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Exceptions\Customer\CheckoutException;
use App\Exceptions\Seller\SellerOrderException;
use App\Models\User;
use App\Services\Customer\CheckoutService;
use App\Services\Customer\CustomerOrderMutationService;
use App\Services\Seller\AcceptSellerOrder;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\OrderLifecycleFixtures;
use Tests\TestCase;

class OrderLifecycleConcurrencyTest extends TestCase
{
    use DatabaseMigrations { runDatabaseMigrations as private migrateLifecycleDatabase; }
    use OrderLifecycleFixtures;

    public function runDatabaseMigrations(): void
    {
        $database = (string) config('database.connections.pgsql.database');
        if (DB::getDriverName() !== 'pgsql' || ! extension_loaded('pcntl') || ! str_starts_with($database, 'aisley_pod_test_')) {
            $this->markTestSkipped('Requires a disposable run-delivery-postgres database and independent pcntl workers.');
        }
        $this->migrateLifecycleDatabase();
    }

    public function test_concurrent_checkout_retries_create_one_order_and_one_reservation(): void
    {
        $context = $this->lifecycleContext(false);
        $payload = $this->lifecycleQuote($context, $context['customer']);
        $key = (string) Str::uuid();
        $jobs = array_fill(0, 2, ['action' => 'place', 'actor_id' => $context['customer']->id, 'payload' => $payload, 'key' => $key]);
        $results = $this->lifecycleWorkers($jobs);
        $this->assertSame([200, 200], array_column($results, 'status'), json_encode($results));
        $this->assertSame($results[0]['id'], $results[1]['id']);
        $this->assertDatabaseCount('checkout_batches', 1);
        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('inventory_movements', 1);
        $this->assertSame([10, 1], [$context['balance']->fresh()->on_hand, $context['balance']->fresh()->reserved]);
    }

    public function test_competing_customers_cannot_reserve_the_same_last_unit(): void
    {
        $context = $this->lifecycleContext(false);
        $context['balance']->update(['on_hand' => 1]);
        $context['product']->update(['stock_quantity' => 1]);
        $other = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $context['address']->replicate()->fill(['user_id' => $other->id])->save();
        $jobs = [];
        foreach ([$context['customer'], $other] as $customer) {
            $jobs[] = ['action' => 'place', 'actor_id' => $customer->id, 'payload' => $this->lifecycleQuote($context, $customer), 'key' => (string) Str::uuid()];
        }
        $results = $this->lifecycleWorkers($jobs);
        $statuses = array_column($results, 'status');
        sort($statuses);
        $this->assertSame(200, $statuses[0], json_encode($results));
        $this->assertContains($statuses[1], [409, 422], json_encode($results));
        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('checkout_batches', 1);
        $this->assertDatabaseCount('inventory_movements', 1);
        $this->assertSame([1, 1], [$context['balance']->fresh()->on_hand, $context['balance']->fresh()->reserved]);
        $this->assertSame(0, $context['product']->fresh()->stock_quantity);
    }

    public function test_seller_approval_and_customer_cancellation_have_one_valid_winner(): void
    {
        $context = $this->lifecycleContext(false);
        $payload = $this->lifecycleQuote($context, $context['customer']);
        $batch = app(CheckoutService::class)->place($context['customer'], $payload, (string) Str::uuid());
        $order = $batch->orders->sole();
        $results = $this->lifecycleWorkers([
            ['action' => 'approve', 'actor_id' => $context['seller']->id, 'order_id' => $order->id, 'key' => (string) Str::uuid()],
            ['action' => 'cancel', 'actor_id' => $context['customer']->id, 'order_id' => $order->id, 'key' => (string) Str::uuid()],
        ]);
        $statuses = array_column($results, 'status');
        sort($statuses);
        $this->assertSame([200, 409], $statuses, json_encode($results));
        $cancelled = $order->fresh()->status === OrderStatus::Cancelled;
        $this->assertContains($order->fresh()->status, [OrderStatus::Cancelled, OrderStatus::SellerProcessing]);
        $this->assertDatabaseCount('customer_order_cancellations', $cancelled ? 1 : 0);
        $this->assertDatabaseCount('seller_order_acceptances', $cancelled ? 0 : 1);
        $this->assertSame(2, $order->statusEvents()->count());
        $this->assertSame([10, $cancelled ? 0 : 1], [$context['balance']->fresh()->on_hand, $context['balance']->fresh()->reserved]);
        $this->assertDatabaseCount('inventory_movements', $cancelled ? 2 : 1);
    }

    private function lifecycleQuote(array $context, User $customer): array
    {
        $this->asLifecycleActor($customer);
        $input = [
            'mode' => 'buy_now', 'buy_now' => ['product_id' => $context['product']->id, 'variant_id' => null, 'quantity' => 1],
            'address_id' => $customer->addresses()->sole()->id, 'payment_method' => 'cod', 'vouchers' => [],
            'logistics_selections' => [['shop_id' => $context['shop']->id, 'logistics_organization_id' => $context['origin'][1]->id]],
        ];
        $quote = $this->postJson('/api/v1/customer/checkout/quote', $input)->assertOk()->json('data');

        return [...$input, 'quote_id' => $quote['quoteId']];
    }

    private function lifecycleWorkers(array $jobs): array
    {
        $start = storage_path('framework/testing/order-lifecycle-'.Str::uuid().'.start');
        if (! is_dir(dirname($start))) {
            mkdir(dirname($start), 0775, true);
        }
        $files = [];
        $pids = [];
        DB::disconnect();
        try {
            foreach ($jobs as $job) {
                $file = $start.'.'.count($files).'.json';
                $files[] = $file;
                $pid = pcntl_fork();
                if ($pid === -1) {
                    throw new \RuntimeException('Unable to create checkout concurrency worker.');
                }
                if ($pid === 0) {
                    try {
                        pcntl_alarm(20);
                        $deadline = microtime(true) + 10;
                        while (! is_file($start) && microtime(true) < $deadline) {
                            usleep(1000);
                        }
                        DB::reconnect();
                        DB::statement("SET statement_timeout = '10s'");
                        $actor = User::findOrFail($job['actor_id']);
                        $result = match ($job['action']) {
                            'place' => app(CheckoutService::class)->place($actor, $job['payload'], $job['key']),
                            'approve' => app(AcceptSellerOrder::class)->handle($actor, $job['order_id'], $job['key']),
                            'cancel' => app(CustomerOrderMutationService::class)->cancel($actor, $job['order_id'], $job['key'], 'Changed plans.'),
                        };
                        $output = ['status' => 200, 'id' => $result->id];
                    } catch (CheckoutException|SellerOrderException $exception) {
                        $output = ['status' => $exception->status, 'code' => $exception->errorCode];
                    } catch (\Throwable $exception) {
                        $output = ['status' => 500, 'type' => $exception::class];
                    }
                    file_put_contents($file, json_encode($output, JSON_THROW_ON_ERROR));
                    exit(0);
                }
                $pids[] = $pid;
            }
            file_put_contents($start, 'start');
            foreach ($pids as $pid) {
                pcntl_waitpid($pid, $status);
                $this->assertTrue(pcntl_wifexited($status), 'Concurrency worker exceeded its deadline.');
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
