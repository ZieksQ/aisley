<?php

namespace Tests\Feature\Messaging;

use App\Enums\CategoryStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Shop;
use App\Models\ShopCategory;
use App\Models\User;
use App\Services\Messaging\ConversationService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class PostgresChatConcurrencyTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Never wipe an application's ordinary database while testing multi-process races.
        $database = (string) config('database.connections.pgsql.database');
        if (DB::getDriverName() !== 'pgsql' || ! str_contains($database, '_chat_verify_')
            || getenv('CHAT_CONCURRENCY_TEST_DB') !== $database || ! function_exists('pcntl_fork')) {
            $this->markTestSkipped('Requires an explicitly named disposable PostgreSQL chat-verification database and pcntl.');
        }
        $this->artisan('migrate:fresh', ['--force' => true])->assertExitCode(0);
    }

    public function test_two_workers_create_one_customer_shop_thread_and_monotonic_messages(): void
    {
        $seller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $category = ShopCategory::create(['name' => 'General', 'slug' => 'general', 'status' => CategoryStatus::Active]);
        $shop = Shop::create(['seller_id' => $seller->id, 'shop_category_id' => $category->id,
            'name' => 'Race Shop', 'slug' => 'race-shop', 'status' => ShopStatus::Active]);

        $this->parallel([
            fn () => app(ConversationService::class)->start(User::findOrFail($customer->id),
                ['shop_id' => $shop->id, 'body' => 'First'], (string) Str::uuid()),
            fn () => app(ConversationService::class)->start(User::findOrFail($customer->id),
                ['shop_id' => $shop->id, 'body' => 'Second'], (string) Str::uuid()),
        ]);
        $conversation = Conversation::query()->sole();
        $this->assertSame(2, $conversation->messages()->count());
        $this->assertSame([1, 2], $conversation->messages()->orderBy('sequence')->pluck('sequence')->all());

        $this->parallel([
            fn () => app(ConversationService::class)->send(User::findOrFail($customer->id), 'customer',
                $conversation->id, ['body' => 'Customer follow-up'], (string) Str::uuid()),
            fn () => app(ConversationService::class)->send(User::findOrFail($seller->id), 'seller',
                $conversation->id, ['body' => 'Seller reply'], (string) Str::uuid()),
        ]);
        $this->assertSame(1, Conversation::query()->count());
        $this->assertSame([1, 2, 3, 4], Message::query()->orderBy('sequence')->pluck('sequence')->all());
        $this->assertSame(4, $conversation->fresh()->last_sequence);
    }

    /** @param array<int, callable(): mixed> $workers */
    private function parallel(array $workers): void
    {
        $children = [];
        foreach ($workers as $work) {
            $sockets = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, 0);
            if ($sockets === false) {
                $this->fail('Could not create worker synchronization socket.');
            }
            $pid = pcntl_fork();
            if ($pid === -1) {
                $this->fail('Could not fork PostgreSQL worker.');
            }
            if ($pid === 0) {
                fclose($sockets[0]);
                DB::disconnect('pgsql');
                DB::purge('pgsql');
                fread($sockets[1], 1);
                try {
                    $work();
                    fwrite($sockets[1], 'ok');
                    exit(0);
                } catch (\Throwable $error) {
                    fwrite($sockets[1], get_class($error).': '.$error->getMessage());
                    exit(1);
                }
            }
            fclose($sockets[1]);
            $children[] = [$pid, $sockets[0]];
        }
        foreach ($children as [, $socket]) {
            fwrite($socket, '1');
        }
        foreach ($children as [$pid, $socket]) {
            $result = stream_get_contents($socket);
            fclose($socket);
            pcntl_waitpid($pid, $status);
            $this->assertSame(0, pcntl_wexitstatus($status), $result ?: 'Worker failed without details.');
            $this->assertSame('ok', $result);
        }
        DB::disconnect('pgsql');
    }
}
