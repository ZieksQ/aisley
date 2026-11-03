<?php

namespace Tests\Feature\Messaging;

use App\Enums\ConversationKind;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Support\CreatesOperationalMessagingContext;
use Tests\TestCase;

class ChatInboxTest extends TestCase
{
    use CreatesOperationalMessagingContext;
    use RefreshDatabase;

    public function test_mixed_inboxes_include_read_and_unread_channels_with_safe_roles_and_context(): void
    {
        [$customer, $seller, $logistics, $threads] = $this->channels();
        foreach ([[$customer, 'customer', ['seller', 'logistics', 'courier']], [$seller, 'seller', ['customer', 'logistics', 'courier']], [$logistics, 'logistics', ['customer', 'seller', 'courier']]] as [$actor, $role, $counterparts]) {
            $result = $this->actingAs($actor)->getJson("/api/v1/$role/chat-inbox")->assertOk()
                ->assertHeader('Cache-Control', 'no-store, private')->assertJsonCount(3, 'data');
            $this->assertEqualsCanonicalizing($counterparts, array_column($result->json('data'), 'counterparty_role'));
            foreach ($counterparts as $counterpart) {
                $filtered = $this->getJson("/api/v1/$role/chat-inbox?counterparty_role=$counterpart")->assertOk()->assertJsonCount(1, 'data');
                $this->assertSame($counterpart, $filtered->json('data.0.counterparty_role'));
                $this->assertSame($filtered->json('data.0.unread_count'), $filtered->json('meta.unread_count'));
            }
            foreach ($result->json('data') as $row) {
                $this->assertEqualsCanonicalizing(['id', 'kind', 'counterparty_role', 'counterparty_label', 'context_label', 'last_message_preview', 'last_message_at', 'unread_count', 'send_allowed', 'read_only_reason'], array_keys($row));
                $this->assertNotEmpty($row['counterparty_label']);
                $this->assertNotNull($row['last_message_at']);
            }
        }
        ConversationParticipant::query()->update(['last_read_sequence' => 1]);
        $this->actingAs($customer)->getJson('/api/v1/customer/chat-inbox')->assertJsonCount(3, 'data')->assertJsonPath('meta.unread_count', 0);
        $this->assertSame(1, ConversationParticipant::query()->min('last_read_sequence'));
        $this->assertCount(6, $threads);
    }

    public function test_cursor_pagination_orders_all_channels_globally_and_keeps_ties_stable(): void
    {
        [$customer, $seller, $logistics, $threads] = $this->channels();
        $shop = $threads[0]->shop;
        for ($i = 0; $i < 23; $i++) {
            $buyer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
            $this->thread(['kind' => ConversationKind::CustomerShop, 'customer_user_id' => $buyer->id, 'seller_user_id' => $seller->id, 'shop_id' => $shop->id], $buyer, $seller);
        }
        // Equal timestamps deliberately exercise UUID tie breaking.
        Conversation::query()->update(['last_message_at' => now()->startOfSecond()]);
        $this->actingAs($seller);
        $all = [];
        $cursor = null;
        do {
            $result = $this->getJson('/api/v1/seller/chat-inbox'.($cursor ? '?cursor='.urlencode($cursor) : ''))->assertOk();
            $all = [...$all, ...array_column($result->json('data'), 'id')];
            $cursor = $result->json('meta.next_cursor');
        } while ($cursor);
        $this->assertCount(26, $all);
        $this->assertCount(26, array_unique($all));
        $sorted = $all;
        rsort($sorted);
        $this->assertSame($sorted, $all);
        $this->assertSame(0, ConversationParticipant::query()->max('last_read_sequence'));
    }

    public function test_foreign_accounts_obsolete_store_participants_and_organizations_are_isolated(): void
    {
        [$customer, $seller, $logistics, $threads] = $this->channels();
        foreach ([['customer', User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active])], ['seller', User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active])], ['logistics', $this->logistics()]] as [$role, $actor]) {
            $this->actingAs($actor)->getJson("/api/v1/$role/chat-inbox")->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('meta.unread_count', 0);
        }
        $replacement = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
        $threads[0]->shop->update(['seller_id' => $replacement->id]);
        foreach ([$seller, $replacement] as $actor) {
            $this->actingAs($actor)->getJson('/api/v1/seller/chat-inbox?counterparty_role=customer')->assertOk()->assertJsonCount(0, 'data');
        }
        $other = $this->logistics();
        $threads[3]->update(['logistics_organization_id' => $other->logisticsOrganization->id, 'logistics_hub_id' => $other->logisticsOrganization->hub->id]);
        foreach ([$logistics, $other] as $actor) {
            $this->actingAs($actor)->getJson('/api/v1/logistics/chat-inbox?counterparty_role=courier')->assertOk()->assertJsonCount(0, 'data');
        }
    }

    public function test_auth_role_approval_validation_and_admin_boundaries(): void
    {
        foreach (['customer', 'seller', 'logistics'] as $role) {
            $this->getJson("/api/v1/$role/chat-inbox")->assertUnauthorized();
        }
        [$customer, $seller, $logistics] = $this->channels();
        foreach ([[$customer, 'customer'], [$seller, 'seller'], [$logistics, 'logistics']] as [$actor, $role]) {
            $this->actingAs($actor)->getJson("/api/v1/$role/chat-inbox?counterparty_role=admin")->assertUnprocessable();
            $this->getJson("/api/v1/$role/chat-inbox?counterparty_role=$role")->assertUnprocessable();
            $actor->update(['status' => UserStatus::Suspended]);
            $this->getJson("/api/v1/$role/chat-inbox")->assertForbidden();
        }
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        foreach (['customer', 'seller', 'logistics'] as $role) {
            $this->actingAs($admin)->getJson("/api/v1/$role/chat-inbox")->assertForbidden();
        }
        $this->getJson('/api/v1/admin/chat-inbox')->assertNotFound();
    }

    private function channels(): array
    {
        [$logistics, $courier, $task] = $this->finalTask();
        $order = $task->shipment->parcel->order;
        $customer = $order->customer;
        $seller = $order->shop->seller;
        $org = $logistics->logisticsOrganization;
        $base = ['logistics_organization_id' => $org->id, 'logistics_hub_id' => $org->hub->id, 'logistics_user_id' => $logistics->id];
        $threads = [];
        $threads[] = $this->thread(['kind' => ConversationKind::CustomerShop, 'customer_user_id' => $customer->id, 'seller_user_id' => $seller->id, 'shop_id' => $order->shop_id], $customer, $seller);
        $threads[] = $this->thread($base + ['kind' => ConversationKind::CustomerLogistics, 'customer_user_id' => $customer->id, 'order_id' => $order->id], $logistics, $customer);
        $threads[] = $this->thread($base + ['kind' => ConversationKind::SellerLogistics, 'seller_user_id' => $seller->id, 'shop_id' => $order->shop_id, 'seller_pickup_request_id' => $order->waybill->seller_pickup_request_id], $logistics, $seller);
        $threads[] = $this->thread($base + ['kind' => ConversationKind::LogisticsCourier, 'courier_user_id' => $courier->id, 'delivery_task_id' => $task->id, 'task_leg' => 'final_mile'], $courier, $logistics);
        $threads[] = $this->thread(['kind' => ConversationKind::CourierCustomer, 'customer_user_id' => $customer->id, 'courier_user_id' => $courier->id, 'delivery_task_id' => $task->id, 'task_leg' => 'final_mile'] + array_diff_key($base, ['logistics_user_id' => true]), $courier, $customer);
        $threads[] = $this->thread(['kind' => ConversationKind::CourierSeller, 'seller_user_id' => $seller->id, 'shop_id' => $order->shop_id, 'courier_user_id' => $courier->id, 'delivery_task_id' => $task->id, 'task_leg' => 'first_mile'], $courier, $seller);

        return [$customer, $seller, $logistics, $threads];
    }

    private function thread(array $attributes, User $sender, User $receiver): Conversation
    {
        $conversation = Conversation::create($attributes);
        foreach ([$sender, $receiver] as $actor) {
            $conversation->participants()->create(['user_id' => $actor->id, 'last_read_sequence' => 0]);
        }
        $message = Message::create(['conversation_id' => $conversation->id, 'sender_user_id' => $sender->id,
            'sequence' => 1, 'body' => 'Please coordinate pickup.', 'idempotency_key' => (string) Str::uuid(), 'payload_hash' => str_repeat('a', 64)]);
        $conversation->update(['last_sequence' => 1, 'last_message_id' => $message->id, 'last_message_at' => $message->created_at]);

        return $conversation;
    }
}
