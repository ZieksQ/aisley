<?php

namespace Tests\Feature\Orders;

use App\Enums\AddressType;
use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Exceptions\Customer\CheckoutException;
use App\Exceptions\Seller\SellerOrderException;
use App\Models\Address;
use App\Models\InventoryMovement;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\Customer\CustomerOrderMutationService;
use App\Services\Customer\ExtendOrderPreparation;
use App\Services\Seller\AcceptSellerOrder;
use App\Services\Seller\RequestSellerPickup;
use Database\Seeders\ProductSeeder;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\Support\ConfiguresCheckoutFinance;
use Tests\TestCase;

class OrderPreparationConcurrencyTest extends TestCase
{
    use ConfiguresCheckoutFinance;
    use DatabaseMigrations { runDatabaseMigrations as private migratePreparationDatabase; }

    public function runDatabaseMigrations(): void
    {
        if (DB::getDriverName() !== 'pgsql' || ! extension_loaded('pcntl') || ! str_starts_with((string) config('database.connections.pgsql.database'), 'aisley_pod_test_')) {
            $this->markTestSkipped('Requires disposable PostgreSQL database and pcntl workers.');
        }
        $this->migratePreparationDatabase();
    }

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(ProductSeeder::class);
        $this->configureTestCheckoutFinance();
    }

    public function test_extension_and_cancellation_have_one_valid_winner(): void
    {
        [$customer, $order] = $this->acceptedOrder();
        $this->travel(4)->days();
        $results = $this->lifecycleWorkers([
            ['action' => 'extend', 'actor_id' => $customer->id, 'order_id' => $order->id, 'key' => (string) Str::uuid()],
            ['action' => 'cancel', 'actor_id' => $customer->id, 'order_id' => $order->id, 'key' => (string) Str::uuid()],
        ]);
        $statuses = array_column($results, 'status');
        sort($statuses);
        $this->assertSame([200, 409], $statuses, json_encode($results));
        $cancelled = $order->fresh()->status === OrderStatus::Cancelled;
        $this->assertDatabaseCount('order_preparation_extensions', $cancelled ? 0 : 1);
        $this->assertDatabaseCount('customer_order_cancellations', $cancelled ? 1 : 0);
        $this->assertSame($cancelled ? 1 : 0, InventoryMovement::where('movement_type', 'release')->count());
    }

    public function test_late_pickup_and_cancellation_have_one_valid_winner(): void
    {
        [$customer, $order] = $this->acceptedOrder();
        $seller = $order->shop->seller;
        $seller->addresses()->update(['latitude' => 14.5, 'longitude' => 121.1]);
        $this->travel(4)->days();
        $results = $this->lifecycleWorkers([
            ['action' => 'pickup', 'actor_id' => $seller->id, 'order_id' => $order->id, 'key' => (string) Str::uuid(), 'address_id' => $seller->addresses()->firstOrFail()->id, 'provider_id' => $order->selected_logistics_organization_id],
            ['action' => 'cancel', 'actor_id' => $customer->id, 'order_id' => $order->id, 'key' => (string) Str::uuid()],
        ]);
        $statuses = array_column($results, 'status');
        sort($statuses);
        $this->assertSame([200, 409], $statuses, json_encode($results));
        $cancelled = $order->fresh()->status === OrderStatus::Cancelled;
        $this->assertContains($order->fresh()->status, [OrderStatus::Cancelled, OrderStatus::ReadyForPickup]);
        $this->assertDatabaseCount('seller_pickup_requests', $cancelled ? 0 : 1);
        $this->assertDatabaseCount('waybills', $cancelled ? 0 : 1);
        $this->assertDatabaseCount('customer_order_cancellations', $cancelled ? 1 : 0);
    }

    public function test_concurrent_exact_extension_retries_commit_once(): void
    {
        [$customer, $order] = $this->acceptedOrder();
        $this->travel(4)->days();
        $job = ['action' => 'extend', 'actor_id' => $customer->id, 'order_id' => $order->id, 'key' => (string) Str::uuid()];
        $results = $this->lifecycleWorkers([$job, $job]);
        $this->assertSame([200, 200], array_column($results, 'status'), json_encode($results));
        $this->assertDatabaseCount('order_preparation_extensions', 1);
        $this->assertSame(1, $order->statusEvents()->where('source', 'customer_preparation_extension')->count());
    }

    private function acceptedOrder(): array
    {
        $this->travelTo(now()->startOfSecond());
        [$customer, $order] = $this->placedOrder(true);
        app(AcceptSellerOrder::class)->handle($order->shop->seller, $order->id, (string) Str::uuid());

        return [$customer, $order->fresh()];
    }

    /** @return array{User, Order} */
    private function placedOrder(bool $pinned = false): array
    {
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        Sanctum::actingAs($customer);
        $address = $this->address($customer);
        if ($pinned) {
            $address->update(['latitude' => 14.5, 'longitude' => 121.1]);
        }
        $product = Product::query()->where('slug', 'compact-everyday-camera')->firstOrFail();
        $payload = [
            'mode' => 'buy_now',
            'buy_now' => ['product_id' => $product->id, 'variant_id' => null, 'quantity' => 1],
            'address_id' => $address->id,
            'payment_method' => 'cod',
            'vouchers' => [],
        ];
        $quote = $this->postJson('/api/v1/customer/checkout/quote', $payload)->assertOk()->json('data.quoteId');
        $batch = $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/customer/checkout/place', [...$payload, 'quote_id' => $quote])
            ->assertOk()
            ->json('data');

        return [$customer, Order::query()->whereKey($batch['orders'][0]['id'])->firstOrFail()];
    }

    private function address(User $customer, string $line = '123 Test Street'): Address
    {
        return Address::create([
            'user_id' => $customer->id,
            'type' => AddressType::Shipping,
            'label' => 'Home',
            'recipient_name' => 'Ada Buyer',
            'contact_number' => '09171234567',
            'address_line_1' => $line,
            'barangay' => 'San Antonio',
            'city_municipality' => 'Makati City',
            'province' => 'Metro Manila',
            'region' => 'NCR',
            'postal_code' => '1203',
            'country' => 'Philippines',
        ]);
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
                            'extend' => app(ExtendOrderPreparation::class)->handle($actor, $job['order_id'], $job['key']),
                            'pickup' => app(RequestSellerPickup::class)->handle($actor, [$job['order_id']], $job['address_id'], $job['provider_id'], $job['key']),
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
