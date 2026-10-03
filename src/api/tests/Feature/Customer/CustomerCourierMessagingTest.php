<?php

namespace Tests\Feature\Customer;

use App\Enums\CourierAffiliationStatus;
use App\Enums\FulfillmentOfferStatus;
use App\Enums\FulfillmentTaskStatus;
use App\Enums\OrderStatus;
use App\Enums\ShipmentStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\Support\CreatesOperationalMessagingContext;
use Tests\TestCase;

class CustomerCourierMessagingTest extends TestCase
{
    use CreatesOperationalMessagingContext;
    use RefreshDatabase;

    public function test_order_contact_is_private_owned_and_requires_an_accepted_offer(): void
    {
        [$logistics, $courier, $task] = $this->finalTask();
        $order = $task->shipment->parcel->order;
        $url = "/api/v1/customer/courier-conversations/order-context/{$order->id}";
        $this->getJson($url)->assertUnauthorized();
        $this->actingAs($logistics)->getJson($url)->assertForbidden();
        $foreign = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $this->actingAs($foreign)->getJson($url)->assertNotFound();
        $this->actingAs($order->customer)->getJson($url)->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')->assertExactJson(['data' => [
                'order_id' => $order->id, 'order_reference' => $order->reference,
                'send_allowed' => false, 'conversation_id' => null,
            ]]);
        $order->update(['status' => OrderStatus::Assigned]);
        $task->update(['status' => FulfillmentTaskStatus::DeliveryAccepted]);
        $this->getJson($url)->assertOk()->assertJsonPath('data.send_allowed', false);
        $task->offers()->update(['status' => FulfillmentOfferStatus::Accepted]);
        $this->getJson($url)->assertOk()->assertJsonPath('data.send_allowed', true);
        $this->assertDatabaseCount('conversations', 0);
        $courier->update(['status' => UserStatus::Suspended]);
        $this->getJson($url)->assertOk()->assertJsonPath('data.send_allowed', false);
    }

    public function test_buyer_start_retries_and_terminal_states_preserve_only_read_only_history(): void
    {
        [, , $task] = $this->acceptedTask();
        $order = $task->shipment->parcel->order;
        $this->actingAs($order->customer);
        $input = ['context_type' => 'order', 'context_id' => $order->id, 'body' => 'I can meet you at the entrance.'];
        $headers = ['Idempotency-Key' => (string) Str::uuid()];
        $id = $this->postJson('/api/v1/customer/courier-conversations', $input, $headers)
            ->assertCreated()->assertJsonPath('conversation.kind', 'courier_customer')->json('conversation.id');
        $this->postJson('/api/v1/customer/courier-conversations', $input, $headers)
            ->assertOk()->assertJsonPath('conversation.id', $id)->assertJsonPath('message.sequence', 1);
        $url = "/api/v1/customer/courier-conversations/order-context/{$order->id}";
        foreach ([FulfillmentTaskStatus::PickedUpFromHub, FulfillmentTaskStatus::InTransit, FulfillmentTaskStatus::OutForDelivery] as $status) {
            $task->update(['status' => $status]);
            $this->getJson($url)->assertOk()->assertJsonPath('data.send_allowed', true)->assertJsonPath('data.conversation_id', $id);
        }
        foreach ([OrderStatus::Delivered, OrderStatus::Cancelled, OrderStatus::DeliveryFailed] as $status) {
            $order->update(['status' => $status]);
            $this->getJson($url)->assertOk()->assertJsonPath('data.send_allowed', false)->assertJsonPath('data.conversation_id', $id);
            $this->postJson("/api/v1/customer/courier-conversations/{$id}/messages", ['body' => 'Late'],
                ['Idempotency-Key' => (string) Str::uuid()])->assertConflict();
        }
        $this->getJson("/api/v1/customer/courier-conversations/{$id}/messages")->assertOk()->assertJsonCount(1, 'data');
        $this->assertDatabaseCount('messages', 1);
    }

    public function test_reassignment_cannot_reuse_old_courier_history_and_custody_changes_disable_contact(): void
    {
        [$logistics, $courier, $task] = $this->acceptedTask();
        $order = $task->shipment->parcel->order;
        $input = ['context_type' => 'order', 'context_id' => $order->id, 'body' => 'First contact'];
        $old = $this->actingAs($order->customer)->postJson('/api/v1/customer/courier-conversations', $input,
            ['Idempotency-Key' => (string) Str::uuid()])->assertCreated()->json('conversation.id');
        $replacement = User::factory()->create(['role' => UserRole::Courier, 'status' => UserStatus::Active]);
        $replacement->courierLogisticsAffiliation()->create([
            'logistics_organization_id' => $task->shipment->logistics_organization_id,
            'logistics_hub_id' => $task->shipment->logistics_hub_id, 'status' => CourierAffiliationStatus::Approved,
        ]);
        $task->update(['courier_id' => $replacement->id]);
        $task->offers()->create([
            'courier_id' => $replacement->id, 'logistics_organization_id' => $task->shipment->logistics_organization_id,
            'offered_by_logistics_id' => $logistics->id, 'sequence' => 2, 'status' => FulfillmentOfferStatus::Accepted,
            'idempotency_key' => (string) Str::uuid(), 'request_hash' => str_repeat('f', 64), 'offered_at' => now(),
        ]);
        $url = "/api/v1/customer/courier-conversations/order-context/{$order->id}";
        $this->getJson($url)->assertOk()->assertJsonPath('data.send_allowed', true)->assertJsonPath('data.conversation_id', null);
        $this->getJson("/api/v1/customer/courier-conversations/{$old}")->assertOk()->assertJsonPath('data.send_allowed', false);
        $new = $this->postJson('/api/v1/customer/courier-conversations', $input,
            ['Idempotency-Key' => (string) Str::uuid()])->assertCreated()->json('conversation.id');
        $this->assertNotSame($old, $new);
        $this->actingAs($replacement)->getJson("/api/v1/courier/operational-conversations/{$old}")->assertNotFound();
        $this->actingAs($courier)->getJson("/api/v1/courier/operational-conversations/{$new}")->assertNotFound();
        $task->shipment->update(['status' => ShipmentStatus::InTransfer]);
        $this->actingAs($order->customer)->getJson($url)->assertOk()->assertJsonPath('data.send_allowed', false);
    }

    private function acceptedTask(): array
    {
        $context = $this->finalTask();
        $context[2]->shipment->parcel->order->update(['status' => OrderStatus::Assigned]);
        $context[2]->update(['status' => FulfillmentTaskStatus::DeliveryAccepted]);
        $context[2]->offers()->update(['status' => FulfillmentOfferStatus::Accepted]);

        return $context;
    }
}
