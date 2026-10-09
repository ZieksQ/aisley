<?php

namespace Tests\Feature\Customer;

use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Order;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\CreatesOperationalMessagingContext;
use Tests\TestCase;

class CustomerChatRateLimitTest extends TestCase
{
    use CreatesOperationalMessagingContext;
    use RefreshDatabase;

    public static function chatChannels(): array
    {
        return [
            'Seller' => ['shop'],
            'Logistics' => ['logistics'],
        ];
    }

    #[DataProvider('chatChannels')]
    public function test_first_message_succeeds_after_ordinary_browsing_and_retries_are_idempotent(string $channel): void
    {
        [$base, $input] = $this->chat($channel);

        for ($request = 0; $request < 20; $request++) {
            $this->getJson('/api/v1/customer/shops')->assertOk();
        }

        $this->assertDatabaseCount('conversations', 0);
        $this->assertDatabaseCount('messages', 0);
        $key = (string) Str::uuid();
        $first = $this->postJson($base, $input, ['Idempotency-Key' => $key])
            ->assertCreated()->assertJsonPath('message.sequence', 1);
        $this->postJson($base, $input, ['Idempotency-Key' => $key])
            ->assertStatus($channel === 'shop' ? 201 : 200)
            ->assertJsonPath('message.id', $first->json('message.id'))
            ->assertJsonPath('conversation.id', $first->json('conversation.id'));
        $this->assertDatabaseCount('conversations', 1);
        $this->assertDatabaseCount('messages', 1);
    }

    #[DataProvider('chatChannels')]
    public function test_starts_have_their_own_budget_and_recover_after_expiry(string $channel): void
    {
        [$base, $input] = $this->chat($channel);

        for ($attempt = 1; $attempt <= 15; $attempt++) {
            $first = $this->start($base, $input)->assertCreated()->assertJsonPath('message.sequence', $attempt);
        }

        $id = $first->json('conversation.id');
        $this->assertThrottled($this->start($base, $input), 15);
        $this->assertDatabaseCount('conversations', 1);
        $this->assertDatabaseCount('messages', 15);
        $this->getJson($base)->assertOk();
        $this->getJson("{$base}/{$id}")->assertOk();
        $this->getJson("{$base}/{$id}/messages")->assertOk();
        $this->markRead($channel, $base, $id, 15)->assertOk();
        $this->send($base, $id)->assertCreated()->assertJsonPath('message.sequence', 16);

        $this->travel(61)->seconds();

        $this->start($base, $input)->assertCreated()->assertJsonPath('message.sequence', 17);
        $this->assertDatabaseCount('conversations', 1);
        $this->assertDatabaseCount('messages', 17);
    }

    #[DataProvider('chatChannels')]
    public function test_polling_and_read_markers_do_not_consume_the_reply_budget(string $channel): void
    {
        [$base, $input] = $this->chat($channel);
        $id = $this->start($base, $input)->assertCreated()->json('conversation.id');

        for ($poll = 0; $poll < 10; $poll++) {
            $this->getJson($base)->assertOk();
            $this->getJson("{$base}/{$id}")->assertOk();
            $this->getJson("{$base}/{$id}/messages")->assertOk();
            $this->markRead($channel, $base, $id, 1)->assertOk();
        }

        for ($attempt = 1; $attempt <= 30; $attempt++) {
            $this->send($base, $id)->assertCreated()->assertJsonPath('message.sequence', $attempt + 1);
        }

        $this->assertThrottled($this->send($base, $id), 30);
        $this->assertDatabaseCount('messages', 31);
        $this->getJson("{$base}/{$id}/messages")->assertOk();
        $this->markRead($channel, $base, $id, 31)->assertOk();
        $this->start($base, $input)->assertCreated()->assertJsonPath('message.sequence', 32);

        $this->travel(61)->seconds();

        $this->send($base, $id)->assertCreated()->assertJsonPath('message.sequence', 33);
        $this->assertDatabaseCount('messages', 33);
    }

    #[DataProvider('chatChannels')]
    public function test_exhausting_one_channel_does_not_throttle_the_other_channel(string $channel): void
    {
        [$base, $input, $order] = $this->chat($channel);

        for ($attempt = 0; $attempt < 15; $attempt++) {
            $id = $this->start($base, $input)->assertCreated()->json('conversation.id');
        }
        for ($attempt = 0; $attempt < 30; $attempt++) {
            $this->send($base, $id)->assertCreated();
        }
        $this->assertThrottled($this->start($base, $input), 15);
        $this->assertThrottled($this->send($base, $id), 30);

        [$otherBase, $otherInput] = $this->channel($channel === 'shop' ? 'logistics' : 'shop', $order);
        $otherId = $this->start($otherBase, $otherInput)->assertCreated()->json('conversation.id');
        $this->send($otherBase, $otherId)->assertCreated()->assertJsonPath('message.sequence', 2);
        $this->assertDatabaseCount('conversations', 2);
        $this->assertDatabaseCount('messages', 47);
    }

    #[DataProvider('chatChannels')]
    public function test_limits_follow_the_account_across_ips_but_do_not_block_another_customer(string $channel): void
    {
        [$base, $input, $order] = $this->chat($channel);

        for ($attempt = 0; $attempt < 15; $attempt++) {
            $id = $this->start($base, $input)->assertCreated()->json('conversation.id');
        }
        for ($attempt = 0; $attempt < 30; $attempt++) {
            $this->send($base, $id)->assertCreated();
        }

        $this->withServerVariables(['REMOTE_ADDR' => '192.0.2.20']);
        $this->assertThrottled($this->start($base, $input), 15);
        $this->assertThrottled($this->send($base, $id), 30);
        $this->withServerVariables(['REMOTE_ADDR' => '127.0.0.1']);

        $otherCustomer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $otherOrder = $this->orderForCustomer($order, $otherCustomer);
        [$otherBase, $otherInput] = $this->channel($channel, $otherOrder);
        $otherId = $this->actingAs($otherCustomer)->start($otherBase, $otherInput)
            ->assertCreated()->json('conversation.id');
        $this->send($otherBase, $otherId)->assertCreated()->assertJsonPath('message.sequence', 2);
        $this->assertDatabaseCount('conversations', 2);
        $this->assertDatabaseCount('messages', 47);
    }

    #[DataProvider('chatChannels')]
    public function test_start_and_reply_limits_are_shared_across_recipients_in_the_same_channel(string $channel): void
    {
        [$base, $input, $order] = $this->chat($channel);

        for ($attempt = 0; $attempt < 14; $attempt++) {
            $id = $this->start($base, $input)->assertCreated()->json('conversation.id');
        }
        for ($attempt = 0; $attempt < 30; $attempt++) {
            $this->send($base, $id)->assertCreated();
        }

        if ($channel === 'shop') {
            $seller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
            $shop = Shop::create([
                'seller_id' => $seller->id,
                'shop_category_id' => $order->shop->shop_category_id,
                'name' => 'Another Shop',
                'slug' => 'another-shop',
                'status' => $order->shop->status,
            ]);
            $input['shop_id'] = $shop->id;
        } else {
            $organization = $this->logistics()->logisticsOrganization;
            $order->parcel->shipment->update([
                'current_logistics_organization_id' => $organization->id,
                'current_hub_id' => $organization->hub->id,
                'status' => 'received_at_hub',
            ]);
        }

        $otherId = $this->start($base, $input)->assertCreated()->json('conversation.id');
        $this->assertNotSame($id, $otherId);
        $this->assertThrottled($this->start($base, $input), 15);
        $this->assertThrottled($this->send($base, $otherId), 30);
        $this->assertDatabaseCount('conversations', 2);
        $this->assertDatabaseCount('messages', 45);

        $this->travel(61)->seconds();

        $this->send($base, $otherId)->assertCreated()->assertJsonPath('message.sequence', 2);
        $this->start($base, $input)->assertCreated()->assertJsonPath('message.sequence', 3);
        $this->assertDatabaseCount('conversations', 2);
        $this->assertDatabaseCount('messages', 47);
    }

    #[DataProvider('chatChannels')]
    public function test_the_overall_customer_request_limit_still_applies(string $channel): void
    {
        [$base, $input] = $this->chat($channel);

        for ($request = 0; $request < 120; $request++) {
            $this->getJson('/api/v1/customer/conversations/unread-count')->assertOk();
        }

        $this->assertThrottled($this->start($base, $input), 120);
        $this->assertDatabaseCount('conversations', 0);
        $this->assertDatabaseCount('messages', 0);

        $this->travel(61)->seconds();

        $this->start($base, $input)->assertCreated();
        $this->assertDatabaseCount('messages', 1);
    }

    /** @return array{string, array<string, string>, Order} */
    private function chat(string $channel): array
    {
        [, , $task] = $this->finalTask();
        $order = $task->shipment->parcel->order;
        $order->update(['status' => OrderStatus::Assigned]);
        $this->actingAs($order->customer);

        return [...$this->channel($channel, $order), $order];
    }

    /** @return array{string, array<string, string>} */
    private function channel(string $channel, Order $order): array
    {
        if ($channel === 'shop') {
            return ['/api/v1/customer/conversations', ['shop_id' => $order->shop_id, 'body' => 'Hello Seller']];
        }

        return ['/api/v1/customer/logistics-conversations', [
            'context_type' => 'order', 'context_id' => $order->id, 'body' => 'Hello Logistics',
        ]];
    }

    private function start(string $base, array $input): TestResponse
    {
        return $this->postJson($base, $input, ['Idempotency-Key' => (string) Str::uuid()]);
    }

    private function send(string $base, string $id): TestResponse
    {
        return $this->postJson("{$base}/{$id}/messages", ['body' => 'Another message'], [
            'Idempotency-Key' => (string) Str::uuid(),
        ]);
    }

    private function markRead(string $channel, string $base, string $id, int $sequence): TestResponse
    {
        return $this->postJson("{$base}/{$id}/read", [
            $channel === 'shop' ? 'sequence' : 'last_read_sequence' => $sequence,
        ]);
    }

    private function assertThrottled(TestResponse $response, int $limit): void
    {
        $response->assertStatus(429)
            ->assertHeader('X-RateLimit-Limit', (string) $limit)
            ->assertHeader('X-RateLimit-Remaining', '0')
            ->assertHeader('Retry-After')
            ->assertHeader('X-RateLimit-Reset');
        $this->assertGreaterThan(0, (int) $response->headers->get('Retry-After'));
    }

    private function orderForCustomer(Order $source, User $customer): Order
    {
        $quote = $source->batch->quote->replicate();
        $quote->customer_id = $customer->id;
        $quote->save();
        $batch = $source->batch->replicate();
        $batch->customer_id = $customer->id;
        $batch->checkout_quote_id = $quote->id;
        $batch->idempotency_key = (string) Str::uuid();
        $batch->save();
        $order = $source->replicate();
        $order->customer_id = $customer->id;
        $order->checkout_batch_id = $batch->id;
        $order->reference = 'MSG-'.Str::upper(Str::random(8));
        $order->save();
        $waybill = $source->waybill->replicate();
        $waybill->order_id = $order->id;
        $waybill->reference = 'WB-'.Str::upper(Str::random(8));
        $waybill->qr_token_hash = hash('sha256', (string) Str::uuid());
        $waybill->save();

        return $order;
    }
}
