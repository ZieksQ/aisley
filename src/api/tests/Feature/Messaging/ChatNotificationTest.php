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
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\CreatesOperationalMessagingContext;
use Tests\TestCase;

class ChatNotificationTest extends TestCase
{
    use CreatesOperationalMessagingContext;
    use RefreshDatabase;

    public function test_first_send_exact_retry_reply_and_read_are_separate_from_general_notifications(): void
    {
        [$logistics, $courier, $task] = $this->finalTask();
        $order = $task->shipment->parcel->order;
        $customer = $order->customer;
        $seller = $order->shop->seller;
        $key = (string) Str::uuid();
        $body = ['shop_id' => $order->shop_id, 'body' => 'Is this available?'];
        $id = $this->actingAs($customer)->postJson('/api/v1/customer/conversations', $body, ['Idempotency-Key' => $key])
            ->assertCreated()->json('conversation.id');
        $this->postJson('/api/v1/customer/conversations', $body, ['Idempotency-Key' => $key])->assertCreated();
        $this->getJson('/api/v1/customer/chat-notifications')->assertOk()->assertJsonPath('meta.unread_count', 0);
        $this->actingAs($seller)->getJson('/api/v1/seller/chat-notifications')->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath('meta.unread_count', 1)
            ->assertJsonPath('data.0.id', $id)->assertJsonPath('data.0.last_message_preview', 'Is this available?');
        $this->postJson("/api/v1/seller/conversations/$id/messages", ['body' => 'Yes.'], ['Idempotency-Key' => (string) Str::uuid()])->assertCreated();
        $this->getJson('/api/v1/seller/chat-notifications')->assertOk()->assertJsonPath('meta.unread_count', 1);
        $this->actingAs($customer)->getJson('/api/v1/customer/chat-notifications')->assertOk()->assertJsonPath('meta.unread_count', 1);
        $this->postJson("/api/v1/customer/conversations/$id/read", ['sequence' => 2])->assertOk();
        $this->getJson('/api/v1/customer/chat-notifications')->assertOk()->assertJsonPath('meta.unread_count', 0)->assertJsonCount(0, 'data');
        $this->actingAs($seller)->getJson('/api/v1/seller/chat-notifications')->assertOk()->assertJsonPath('meta.unread_count', 1);
        $this->postJson("/api/v1/seller/conversations/$id/read", ['sequence' => 2])->assertOk();
        $this->getJson('/api/v1/seller/chat-notifications')->assertOk()->assertJsonPath('meta.unread_count', 0);
        $this->assertDatabaseCount('messages', 2);
        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_all_role_channels_aggregate_without_exposing_foreign_threads_or_private_fields(): void
    {
        [$logistics, $courier, $task] = $this->finalTask();
        $order = $task->shipment->parcel->order;
        $shop = $order->shop;
        $customer = $order->customer;
        $seller = $shop->seller;
        $org = $logistics->logisticsOrganization;
        $base = ['logistics_organization_id' => $org->id, 'logistics_hub_id' => $org->hub->id, 'logistics_user_id' => $logistics->id];
        $this->thread(['kind' => ConversationKind::CustomerShop, 'customer_user_id' => $customer->id, 'seller_user_id' => $seller->id, 'shop_id' => $shop->id], $customer, $seller);
        $this->thread($base + ['kind' => ConversationKind::CustomerLogistics, 'customer_user_id' => $customer->id, 'order_id' => $order->id], $logistics, $customer);
        $this->thread($base + ['kind' => ConversationKind::SellerLogistics, 'seller_user_id' => $seller->id, 'shop_id' => $shop->id, 'seller_pickup_request_id' => $order->waybill->seller_pickup_request_id], $logistics, $seller);
        $this->thread($base + ['kind' => ConversationKind::LogisticsCourier, 'courier_user_id' => $courier->id, 'delivery_task_id' => $task->id, 'task_leg' => 'final_mile'], $courier, $logistics);
        $this->thread(['kind' => ConversationKind::CourierCustomer, 'customer_user_id' => $customer->id, 'courier_user_id' => $courier->id, 'delivery_task_id' => $task->id, 'task_leg' => 'final_mile'] + array_diff_key($base, ['logistics_user_id' => true]), $courier, $customer);
        // A separate task counterpart retains its existing scope even when its relationship is read-only.
        $this->thread(['kind' => ConversationKind::CourierSeller, 'seller_user_id' => $seller->id, 'shop_id' => $shop->id, 'courier_user_id' => $courier->id, 'delivery_task_id' => $task->id, 'task_leg' => 'first_mile'], $courier, $seller);
        foreach ([[$customer, 'customer', 2], [$seller, 'seller', 3], [$logistics, 'logistics', 1]] as [$actor, $role, $count]) {
            $response = $this->actingAs($actor)->getJson("/api/v1/$role/chat-notifications")->assertOk()->assertJsonPath('meta.unread_count', $count)->assertJsonCount($count, 'data');
            foreach ($response->json('data') as $item) {
                $this->assertEqualsCanonicalizing(['id', 'kind', 'counterparty_label', 'last_message_preview', 'last_message_at', 'unread_count'], array_keys($item));
            }
        }
        foreach (Conversation::all() as $conversation) {
            $first = $conversation->messages()->firstOrFail();
            $receiverId = $conversation->participants()->where('user_id', '!=', $first->sender_user_id)->value('user_id');
            $reply = Message::create(['conversation_id' => $conversation->id, 'sender_user_id' => $receiverId,
                'sequence' => 2, 'body' => 'Reply', 'idempotency_key' => (string) Str::uuid(), 'payload_hash' => str_repeat('b', 64)]);
            $conversation->update(['last_sequence' => 2, 'last_message_id' => $reply->id, 'last_message_at' => $reply->created_at]);
        }
        foreach ([[$customer, 'customer'], [$seller, 'seller'], [$logistics, 'logistics']] as [$actor, $role]) {
            $this->actingAs($actor)->getJson("/api/v1/$role/chat-notifications")->assertOk()->assertJsonPath('meta.unread_count', 3)->assertJsonCount(3, 'data');
        }
        $foreignCustomer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $foreignSeller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
        foreach ([[$foreignCustomer, 'customer'], [$foreignSeller, 'seller'], [$this->logistics(), 'logistics']] as [$actor, $role]) {
            $this->actingAs($actor)->getJson("/api/v1/$role/chat-notifications")->assertOk()->assertJsonPath('meta.unread_count', 0)->assertJsonCount(0, 'data');
        }
    }

    public function test_preview_limit_does_not_limit_total_and_opening_preview_does_not_mark_read(): void
    {
        [$logistics, $courier, $task] = $this->finalTask();
        $shop = $task->shipment->parcel->order->shop;
        $ids = [];
        for ($i = 0; $i < 7; $i++) {
            $this->travel(1)->seconds();
            $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
            $conversation = $this->thread(['kind' => ConversationKind::CustomerShop, 'customer_user_id' => $customer->id, 'seller_user_id' => $shop->seller_id, 'shop_id' => $shop->id], $customer, $shop->seller);
            $ids[] = $conversation->id;
        }
        $this->actingAs($shop->seller)->getJson('/api/v1/seller/chat-notifications')->assertOk()
            ->assertJsonPath('meta.unread_count', 7)->assertJsonCount(5, 'data')
            ->assertJsonPath('data.0.id', $ids[6])->assertJsonPath('data.4.id', $ids[2]);
        $this->getJson('/api/v1/seller/chat-notifications')->assertJsonPath('meta.unread_count', 7);
        $this->assertSame(0, ConversationParticipant::query()->max('last_read_sequence'));
    }

    public function test_store_scope_is_enforced_even_when_an_obsolete_participant_marker_exists(): void
    {
        [$logistics, $courier, $task] = $this->finalTask();
        $order = $task->shipment->parcel->order;
        $oldSeller = $order->shop->seller;
        $this->thread(['kind' => ConversationKind::CustomerShop, 'customer_user_id' => $order->customer_id, 'seller_user_id' => $oldSeller->id, 'shop_id' => $order->shop_id], $order->customer, $oldSeller);
        $newSeller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
        $order->shop->update(['seller_id' => $newSeller->id]);
        foreach ([$oldSeller, $newSeller] as $seller) {
            $this->actingAs($seller)->getJson('/api/v1/seller/chat-notifications')->assertOk()->assertJsonPath('meta.unread_count', 0);
        }
    }

    public function test_logistics_scope_rejects_an_obsolete_participant_for_another_organization(): void
    {
        [$logistics, $courier, $task] = $this->finalTask();
        $org = $logistics->logisticsOrganization;
        $conversation = $this->thread(['kind' => ConversationKind::LogisticsCourier,
            'logistics_organization_id' => $org->id, 'logistics_hub_id' => $org->hub->id,
            'logistics_user_id' => $logistics->id, 'courier_user_id' => $courier->id,
            'delivery_task_id' => $task->id, 'task_leg' => 'final_mile'], $courier, $logistics);
        $this->actingAs($logistics)->getJson('/api/v1/logistics/chat-notifications')->assertOk()->assertJsonPath('meta.unread_count', 1);
        $other = $this->logistics();
        $conversation->update(['logistics_organization_id' => $other->logisticsOrganization->id,
            'logistics_hub_id' => $other->logisticsOrganization->hub->id]);
        foreach ([$logistics, $other] as $actor) {
            $this->actingAs($actor)->getJson('/api/v1/logistics/chat-notifications')->assertOk()->assertJsonPath('meta.unread_count', 0);
        }
    }

    public function test_failed_send_and_rolled_back_persistence_create_no_chat_alert(): void
    {
        [$logistics, $courier, $task] = $this->finalTask();
        $order = $task->shipment->parcel->order;
        $this->actingAs($order->customer)->postJson('/api/v1/customer/conversations', ['shop_id' => $order->shop_id, 'body' => ''], ['Idempotency-Key' => (string) Str::uuid()])->assertUnprocessable();
        DB::beginTransaction();
        $this->thread(['kind' => ConversationKind::CustomerShop, 'customer_user_id' => $order->customer_id, 'seller_user_id' => $order->shop->seller_id, 'shop_id' => $order->shop_id], $order->customer, $order->shop->seller);
        DB::rollBack();
        $this->actingAs($order->shop->seller)->getJson('/api/v1/seller/chat-notifications')->assertOk()->assertJsonPath('meta.unread_count', 0);
    }

    public function test_auth_role_and_account_gates_apply_to_every_endpoint(): void
    {
        foreach (['customer', 'seller', 'logistics'] as $role) {
            $this->getJson("/api/v1/$role/chat-notifications")->assertUnauthorized();
        }
        $admin = User::factory()->create(['role' => UserRole::Admin, 'status' => UserStatus::Active]);
        foreach (['customer', 'seller', 'logistics'] as $role) {
            $this->actingAs($admin)->getJson("/api/v1/$role/chat-notifications")->assertForbidden();
            foreach ([UserStatus::Pending, UserStatus::Suspended, UserStatus::Deactivated] as $status) {
                $actor = User::factory()->create(['role' => UserRole::from($role), 'status' => $status]);
                $this->actingAs($actor)->getJson("/api/v1/$role/chat-notifications")->assertForbidden();
            }
        }
    }

    private function thread(array $attributes, User $sender, User $receiver): Conversation
    {
        $conversation = Conversation::create($attributes);
        foreach ([$sender, $receiver] as $actor) {
            $conversation->participants()->create(['user_id' => $actor->id, 'last_read_sequence' => 0]);
        }
        $message = Message::create(['conversation_id' => $conversation->id, 'sender_user_id' => $sender->id,
            'sequence' => 1, 'body' => '[Image]', 'idempotency_key' => (string) Str::uuid(), 'payload_hash' => str_repeat('a', 64)]);
        $conversation->update(['last_sequence' => 1, 'last_message_id' => $message->id, 'last_message_at' => $message->created_at]);

        return $conversation;
    }
}
