<?php

namespace Tests\Feature\Vouchers;

use App\Exceptions\Customer\CheckoutException;
use App\Models\User;
use App\Models\Voucher;
use App\Services\Customer\CheckoutService;
use App\Services\Vouchers\VoucherMutationService;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\OrderLifecycleFixtures;
use Tests\Support\VoucherAuthoringFixtures;
use Tests\TestCase;

class VoucherConcurrencyTest extends TestCase
{
    use DatabaseMigrations { runDatabaseMigrations as private migrateVoucherDatabase; }
    use OrderLifecycleFixtures, VoucherAuthoringFixtures;

    public function runDatabaseMigrations(): void
    {
        if (DB::getDriverName() !== 'pgsql' || ! extension_loaded('pcntl') || ! str_starts_with((string) config('database.connections.pgsql.database'), 'aisley_pod_test_')) {
            $this->markTestSkipped('Requires disposable PostgreSQL and independent pcntl workers.');
        }
        $this->migrateVoucherDatabase();
    }

    public function test_identical_create_and_publish_requests_replay_once(): void
    {
        $actor = $this->voucherActor();
        $data = [...$this->voucherTerms(), 'currency' => 'PHP', 'minimum_spend' => 0, 'per_customer_limit' => 1, 'stacking' => false, 'idempotency_key' => (string) Str::uuid()];
        $results = $this->workers([
            fn () => app(VoucherMutationService::class)->execute(User::findOrFail($actor->id), 'create', null, $data),
            fn () => app(VoucherMutationService::class)->execute(User::findOrFail($actor->id), 'create', null, $data),
        ]);
        $this->assertSame([200, 200], array_column($results, 'status'));
        $this->assertSame($results[0]['data'], $results[1]['data']);
        $this->assertDatabaseCount('vouchers', 1);
        $voucher = $results[0]['data'];
        $input = ['revision' => $voucher['revision'], 'idempotency_key' => (string) Str::uuid()];
        $results = $this->workers([
            fn () => app(VoucherMutationService::class)->execute(User::findOrFail($actor->id), 'publish', $voucher['id'], $input),
            fn () => app(VoucherMutationService::class)->execute(User::findOrFail($actor->id), 'publish', $voucher['id'], $input),
        ]);
        $this->assertSame([200, 200], array_column($results, 'status'));
        $this->assertSame($results[0]['data'], $results[1]['data']);
        $this->assertDatabaseCount('voucher_versions', 1);
        $this->assertDatabaseCount('voucher_actions', 2);
        $this->assertDatabaseCount('voucher_mutation_receipts', 2);
    }

    public function test_publication_and_end_with_distinct_keys_have_one_revision_winner(): void
    {
        $actor = $this->voucherActor();
        $voucher = $this->draftVoucher();
        $results = $this->workers(array_map(fn ($action) => fn () => app(VoucherMutationService::class)->execute(User::findOrFail($actor->id), $action, $voucher['id'], ['revision' => 1, 'idempotency_key' => (string) Str::uuid()]), ['publish', 'end']));
        $statuses = array_column($results, 'status');
        sort($statuses);
        $this->assertSame([200, 409], $statuses);
        $this->assertDatabaseCount('voucher_actions', 2);
        $this->assertSame(2, Voucher::findOrFail($voucher['id'])->revision);
    }

    public function test_last_redemption_publication_and_pause_serialize_with_checkout(): void
    {
        Http::preventStrayRequests();
        config(['hub-routing.enabled' => true, 'services.geoapify.server_key' => 'test-key']);
        Http::fake(['api.geoapify.com/v1/routematrix*' => Http::response(['sources_to_targets' => [[['distance' => 1000, 'time' => 100]]]])]);
        $context = $this->lifecycleContext(false);
        $actor = $this->voucherActor();
        $voucher = $this->voucherAction($this->draftVoucher('admin', ['global_limit' => 1, 'value' => 10]), 'publish')->assertOk()->json('data');
        $other = User::factory()->create(['role' => 'customer', 'status' => 'active']);
        $context['address']->replicate()->fill(['user_id' => $other->id])->save();
        $jobs = [];
        foreach ([$context['customer'], $other] as $customer) {
            $intent = [
                'mode' => 'buy_now', 'buy_now' => ['product_id' => $context['product']->id, 'variant_id' => null, 'quantity' => 1],
                'address_id' => $customer->addresses()->sole()->id, 'payment_method' => 'cod',
                'logistics_selections' => [['shop_id' => $context['shop']->id, 'logistics_organization_id' => $context['origin'][1]->id]],
                'vouchers' => [['voucher_id' => $voucher['id'], 'target_shop_id' => $context['shop']->id]],
            ];
            $quote = app(CheckoutService::class)->quote($customer, $intent);
            $payload = [...$intent, 'quote_id' => $quote['quoteId']];
            $jobs[] = fn () => ['data' => ['id' => app(CheckoutService::class)->place(User::findOrFail($customer->id), $payload, (string) Str::uuid())->id]];
        }
        $results = $this->workers($jobs);
        $statuses = array_column($results, 'status');
        sort($statuses);
        $this->assertSame([200, 409], $statuses);
        $this->assertDatabaseCount('voucher_redemptions', 1);
        $this->assertSame(1, Voucher::findOrFail($voucher['id'])->redeemed_count);
        // A replacement is serialized against pause on the same checkout row.
        $this->actingAs($actor);
        $working = $this->withHeader('Idempotency-Key', (string) Str::uuid())->putJson('/api/v1/admin/vouchers/'.$voucher['id'].'/draft', $this->voucherTerms(['code' => $voucher['code'], 'revision' => $voucher['revision'], 'value' => 15, 'global_limit' => 1]))->assertOk()->json('data');
        $results = $this->workers(array_map(fn ($action) => fn () => app(VoucherMutationService::class)->execute(User::findOrFail($actor->id), $action, $voucher['id'], ['revision' => $working['revision'], 'idempotency_key' => (string) Str::uuid()]), ['publish', 'pause']));
        $statuses = array_column($results, 'status');
        sort($statuses);
        $this->assertSame([200, 409], $statuses);
        $this->assertSame(1, Voucher::findOrFail($voucher['id'])->redeemed_count);
    }

    public static function checkoutMutations(): array
    {
        return ['publication' => ['publish'], 'pause' => ['pause'], 'permanent end' => ['end']];
    }

    #[DataProvider('checkoutMutations')]
    public function test_checkout_and_authoring_share_the_same_voucher_lock(string $action): void
    {
        $this->travelTo(now()->startOfSecond());
        config(['hub-routing.enabled' => true, 'services.geoapify.server_key' => 'test-key']);
        Http::preventStrayRequests();
        Http::fake(['api.geoapify.com/v1/routematrix*' => Http::response(['sources_to_targets' => [[['distance' => 1000, 'time' => 100]]]])]);
        $context = $this->lifecycleContext(false);
        $actor = $this->voucherActor();
        $voucher = $this->voucherAction($this->draftVoucher('admin', ['global_limit' => 1, 'value' => 10]), 'publish')->assertOk()->json('data');
        if ($action === 'publish') {
            $voucher = $this->withHeader('Idempotency-Key', (string) Str::uuid())->putJson('/api/v1/admin/vouchers/'.$voucher['id'].'/draft', $this->voucherTerms(['revision' => $voucher['revision'], 'code' => $voucher['code'], 'value' => 15, 'global_limit' => 1]))->assertOk()->json('data');
        }
        $input = [
            'mode' => 'buy_now', 'buy_now' => ['product_id' => $context['product']->id, 'variant_id' => null, 'quantity' => 1],
            'address_id' => $context['address']->id, 'payment_method' => 'cod',
            'logistics_selections' => [['shop_id' => $context['shop']->id, 'logistics_organization_id' => $context['origin'][1]->id]],
            'vouchers' => [['voucher_id' => $voucher['id'], 'target_shop_id' => $context['shop']->id]],
        ];
        $quote = app(CheckoutService::class)->quote($context['customer'], $input);
        $results = $this->workers([
            fn () => ['data' => ['id' => app(CheckoutService::class)->place(User::findOrFail($context['customer']->id), [...$input, 'quote_id' => $quote['quoteId']], (string) Str::uuid())->id]],
            fn () => app(VoucherMutationService::class)->execute(User::findOrFail($actor->id), $action, $voucher['id'], ['revision' => $voucher['revision'], 'idempotency_key' => (string) Str::uuid()]),
        ]);
        $this->assertSame(200, $results[1]['status']);
        $this->assertContains($results[0]['status'], [200, 409, 422]);
        $uses = $results[0]['status'] === 200 ? 1 : 0;
        $this->assertDatabaseCount('orders', $uses);
        $this->assertDatabaseCount('voucher_redemptions', $uses);
        $this->assertSame($uses, Voucher::findOrFail($voucher['id'])->redeemed_count);
        if ($uses) {
            $this->assertDatabaseHas('order_vouchers', ['voucher_id' => $voucher['id'], 'discount_amount' => '10.00', 'rule_version' => 1]);
        }
    }

    private function workers(array $operations): array
    {
        $start = storage_path('framework/testing/vouchers-'.Str::uuid().'.start');
        if (! is_dir(dirname($start))) {
            mkdir(dirname($start), 0775, true);
        }
        $files = [];
        $pids = [];
        DB::disconnect();
        try {
            foreach ($operations as $operation) {
                $file = $start.'.'.count($files).'.json';
                $files[] = $file;
                $pid = pcntl_fork();
                if ($pid === -1) {
                    throw new \RuntimeException('Unable to start voucher worker.');
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
                        $result = $operation();
                        $output = ['status' => 200, 'data' => $result['data']];
                    } catch (CheckoutException $error) {
                        $output = ['status' => $error->status];
                    } catch (HttpResponseException $error) {
                        $output = ['status' => $error->getResponse()->getStatusCode()];
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

            return $results;
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
