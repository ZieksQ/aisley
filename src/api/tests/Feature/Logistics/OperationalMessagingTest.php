<?php

namespace Tests\Feature\Logistics;

use App\Enums\AddressType;
use App\Enums\CategoryStatus;
use App\Enums\CourierAffiliationStatus;
use App\Enums\FirstMileTaskStatus;
use App\Enums\FulfillmentOfferStatus;
use App\Enums\FulfillmentTaskLeg;
use App\Enums\FulfillmentTaskStatus;
use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Enums\PaymentStatus;
use App\Enums\ShopStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\CheckoutBatch;
use App\Models\CheckoutQuote;
use App\Models\DeliveryTask;
use App\Models\FirstMileTask;
use App\Models\Order;
use App\Models\Parcel;
use App\Models\PickupSchedule;
use App\Models\SellerPickupRequest;
use App\Models\Shipment;
use App\Models\Shop;
use App\Models\ShopCategory;
use App\Models\User;
use App\Models\Waybill;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class OperationalMessagingTest extends TestCase
{
    use RefreshDatabase;

    public function test_logistics_and_courier_share_an_idempotent_task_thread_with_private_read_state(): void
    {
        [$logistics, $courier, $task] = $this->finalTask();
        $key = (string) Str::uuid();
        $start = ['leg' => 'final_mile', 'task_id' => $task->id, 'body' => ' Please confirm your arrival. '];
        $this->getJson('/api/v1/logistics/operational-conversations')->assertUnauthorized();
        $first = $this->actingAs($logistics)->postJson('/api/v1/logistics/operational-conversations', $start, ['Idempotency-Key' => $key])
            ->assertCreated()->assertJsonPath('message.body', 'Please confirm your arrival.')
            ->assertJsonPath('conversation.counterparty_role', 'courier');
        $id = $first->json('conversation.id');
        $this->actingAs($courier)->getJson('/api/v1/logistics/operational-conversations')->assertForbidden();
        $this->actingAs($task->shipment->parcel->order->customer)
            ->getJson("/api/v1/customer/conversations/{$id}")->assertNotFound();
        $this->actingAs($logistics);
        $this->postJson('/api/v1/logistics/operational-conversations', $start, ['Idempotency-Key' => $key])
            ->assertOk()->assertJsonPath('conversation.id', $id);
        $this->postJson('/api/v1/logistics/operational-conversations', [...$start, 'body' => 'Changed'], ['Idempotency-Key' => $key])
            ->assertConflict()->assertJsonPath('code', 'IDEMPOTENCY_CONFLICT');

        $this->actingAs($courier)->getJson('/api/v1/courier/operational-conversations')
            ->assertOk()->assertJsonPath('data.0.unread_count', 1)->assertJsonMissingPath('data.0.email');
        $this->postJson("/api/v1/courier/operational-conversations/{$id}/messages", ['body' => 'On my way.'], [
            'Idempotency-Key' => (string) Str::uuid(),
        ])->assertCreated()->assertJsonPath('message.sequence', 2);
        $this->postJson("/api/v1/courier/operational-conversations/{$id}/read", ['last_read_sequence' => 2])
            ->assertOk()->assertJsonPath('data.unread_count', 0);
        $this->postJson("/api/v1/courier/operational-conversations/{$id}/read", ['last_read_sequence' => 1])
            ->assertOk()->assertJsonPath('data.last_read_sequence', 2);
        $this->actingAs($logistics)->getJson("/api/v1/logistics/operational-conversations/{$id}")
            ->assertOk()->assertJsonPath('data.unread_count', 1);
        $this->getJson("/api/v1/logistics/operational-conversations/{$id}/messages")
            ->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.0.body', 'Please confirm your arrival.');
        $this->assertDatabaseCount('conversations', 1);
        $this->assertDatabaseCount('messages', 2);
    }

    public function test_task_reassignment_preserves_old_history_but_blocks_sends_and_foreign_access(): void
    {
        [$logistics, $courier, $task] = $this->finalTask();
        $id = $this->actingAs($courier)->postJson('/api/v1/courier/operational-conversations', [
            'leg' => 'final_mile', 'task_id' => $task->id, 'counterparty_role' => 'logistics', 'body' => 'I can take this task.',
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertCreated()->json('conversation.id');
        $other = User::factory()->create(['role' => UserRole::Courier, 'status' => UserStatus::Active]);
        $other->courierLogisticsAffiliation()->create([
            'logistics_organization_id' => $task->shipment->logistics_organization_id,
            'logistics_hub_id' => $task->shipment->logistics_hub_id,
            'status' => CourierAffiliationStatus::Approved,
        ]);
        $task->update(['status' => FulfillmentTaskStatus::Rejected]);
        $task->offers()->update(['status' => FulfillmentOfferStatus::Rejected]);
        $this->actingAs($courier)->getJson("/api/v1/courier/operational-conversations/{$id}")
            ->assertOk()->assertJsonPath('data.send_allowed', false);
        $this->postJson("/api/v1/courier/operational-conversations/{$id}/messages", ['body' => 'Late reply'], [
            'Idempotency-Key' => (string) Str::uuid(),
        ])->assertConflict();
        $this->actingAs($other)->getJson("/api/v1/courier/operational-conversations/{$id}")->assertNotFound();
        $this->postJson('/api/v1/courier/operational-conversations', [
            'leg' => 'final_mile', 'task_id' => $task->id, 'counterparty_role' => 'logistics', 'body' => 'Forged',
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertNotFound();
        $foreign = $this->logistics();
        $this->actingAs($foreign)->getJson("/api/v1/logistics/operational-conversations/{$id}")->assertNotFound();
        $this->postJson('/api/v1/logistics/operational-conversations', [
            'leg' => 'final_mile', 'task_id' => $task->id, 'body' => 'Foreign context',
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertNotFound();
        $this->assertDatabaseCount('messages', 1);
        $this->assertDatabaseCount('conversations', 1);
        $this->actingAs($logistics)->getJson("/api/v1/logistics/operational-conversations/{$id}")->assertOk();
    }

    public function test_affiliation_alone_and_invalid_body_cannot_create_a_thread(): void
    {
        [$logistics, $courier, $task] = $this->finalTask();
        $other = User::factory()->create(['role' => UserRole::Courier, 'status' => UserStatus::Active]);
        $other->courierLogisticsAffiliation()->create([
            'logistics_organization_id' => $task->shipment->logistics_organization_id,
            'logistics_hub_id' => $task->shipment->logistics_hub_id,
            'status' => CourierAffiliationStatus::Approved,
        ]);
        $this->actingAs($other)->postJson('/api/v1/courier/operational-conversations', [
            'leg' => 'final_mile', 'task_id' => $task->id, 'counterparty_role' => 'logistics', 'body' => 'No task',
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertNotFound();
        $this->actingAs($logistics)->postJson('/api/v1/logistics/operational-conversations', [
            'leg' => 'final_mile', 'task_id' => $task->id, 'body' => '   ',
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertUnprocessable();
        $this->postJson('/api/v1/logistics/operational-conversations', [
            'leg' => 'final_mile', 'task_id' => $task->id, 'body' => 'Do not trust this', 'courier_id' => $courier->id,
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertUnprocessable();
        $this->assertDatabaseCount('conversations', 0);
    }

    public function test_first_mile_legacy_task_reference_resolves_to_the_shared_task_and_becomes_read_only_after_pickup(): void
    {
        [$logistics, $courier, $final] = $this->finalTask();
        $shipment = $final->shipment;
        $waybill = $shipment->parcel->waybill;
        $schedule = PickupSchedule::create([
            'logistics_organization_id' => $shipment->logistics_organization_id,
            'logistics_hub_id' => $shipment->logistics_hub_id,
            'courier_id' => $courier->id,
            'reference' => 'PICK-'.Str::upper(Str::random(8)),
            'status' => 'scheduled',
            'starts_at' => now()->addHour(),
            'ends_at' => now()->addHours(2),
            'idempotency_key' => (string) Str::uuid(),
        ]);
        $legacy = FirstMileTask::create([
            'pickup_schedule_id' => $schedule->id,
            'order_id' => $waybill->order_id,
            'waybill_id' => $waybill->id,
            'logistics_organization_id' => $shipment->logistics_organization_id,
            'logistics_hub_id' => $shipment->logistics_hub_id,
            'courier_id' => $courier->id,
            'status' => FirstMileTaskStatus::Assigned,
        ]);
        $shared = DeliveryTask::create([
            'shipment_id' => $shipment->id,
            'leg' => FulfillmentTaskLeg::FirstMile,
            'status' => FulfillmentTaskStatus::SellerPickupAssigned,
            'courier_id' => $courier->id,
            'legacy_first_mile_task_id' => $legacy->id,
        ]);
        $start = $this->actingAs($courier)->postJson('/api/v1/courier/operational-conversations', [
            'leg' => 'first_mile', 'task_id' => $legacy->id, 'counterparty_role' => 'logistics',
            'body' => 'I am heading to the Seller.',
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertCreated()
            ->assertJsonPath('conversation.task_id', $legacy->id);
        $id = $start->json('conversation.id');
        $this->actingAs($logistics)->postJson('/api/v1/logistics/operational-conversations', [
            'leg' => 'first_mile', 'task_id' => $shared->id, 'body' => 'Thank you.',
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertCreated()
            ->assertJsonPath('conversation.id', $id)->assertJsonPath('message.sequence', 2);
        $legacy->update(['status' => FirstMileTaskStatus::PickedUp]);
        $shared->update(['status' => FulfillmentTaskStatus::PickedUpFromSeller]);
        $this->actingAs($courier)->getJson("/api/v1/courier/operational-conversations/{$id}")
            ->assertOk()->assertJsonPath('data.send_allowed', false);
        $this->postJson("/api/v1/courier/operational-conversations/{$id}/messages", ['body' => 'Too late'], [
            'Idempotency-Key' => (string) Str::uuid(),
        ])->assertConflict();
        $this->assertDatabaseCount('conversations', 1);
    }

    public function test_operational_extension_can_roll_back_and_reapply_on_sqlite(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            $this->markTestSkipped('SQLite migration rebuild check.');
        }
        $migration = require database_path('migrations/2026_09_24_000001_extend_conversations_for_operational_messaging.php');
        $orderMigration = require database_path('migrations/2026_09_24_000002_add_order_conversations.php');
        $pickupMigration = require database_path('migrations/2026_09_24_000003_add_pickup_request_conversations.php');
        $counterpartyMigration = require database_path('migrations/2026_09_24_000004_add_courier_counterparty_conversations.php');
        DB::statement('PRAGMA defer_foreign_keys = ON');
        $counterpartyMigration->down();
        $pickupMigration->down();
        $orderMigration->down();
        $migration->down();
        $migration->up();
        $orderMigration->up();
        $pickupMigration->up();
        $counterpartyMigration->up();

        $this->assertSame([], DB::select('PRAGMA foreign_key_check'));
        $this->assertDatabaseCount('conversations', 0);
    }

    public function test_customer_contacts_only_the_current_order_handler_in_a_separate_thread(): void
    {
        [$logistics, , $task] = $this->finalTask();
        $order = $task->shipment->parcel->order;
        $customer = $order->customer;
        $order->update(['status' => OrderStatus::Assigned]);
        $anotherCustomer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $anotherLogistics = $this->logistics();
        $start = ['context_type' => 'order', 'context_id' => $order->id, 'body' => ' Where is my parcel? '];
        $key = (string) Str::uuid();

        $this->postJson('/api/v1/customer/logistics-conversations', $start, ['Idempotency-Key' => $key])->assertUnauthorized();
        $this->actingAs($anotherCustomer)->postJson('/api/v1/customer/logistics-conversations', $start,
            ['Idempotency-Key' => (string) Str::uuid()])->assertNotFound();
        $this->actingAs($anotherLogistics)->postJson('/api/v1/logistics/operational-conversations', $start,
            ['Idempotency-Key' => (string) Str::uuid()])->assertNotFound();

        $first = $this->actingAs($customer)->postJson('/api/v1/customer/logistics-conversations', $start,
            ['Idempotency-Key' => $key])->assertCreated()->assertJsonPath('message.body', 'Where is my parcel?')
            ->assertJsonPath('conversation.kind', 'customer_logistics');
        $id = $first->json('conversation.id');
        $this->postJson('/api/v1/customer/logistics-conversations', [...$start, 'body' => 'Where is my parcel?'],
            ['Idempotency-Key' => $key])->assertOk()->assertJsonPath('conversation.id', $id);
        $this->postJson('/api/v1/customer/logistics-conversations', [...$start, 'body' => 'Changed'],
            ['Idempotency-Key' => $key])->assertConflict();
        $this->actingAs($anotherCustomer)->getJson("/api/v1/customer/logistics-conversations/{$id}")->assertNotFound();
        $this->actingAs($anotherLogistics)->getJson("/api/v1/logistics/operational-conversations/{$id}")->assertNotFound();
        $this->actingAs($logistics)->getJson('/api/v1/logistics/operational-conversations')
            ->assertOk()->assertJsonPath('data.0.id', $id)->assertJsonPath('meta.unread_count', 1);
        $this->postJson("/api/v1/logistics/operational-conversations/{$id}/messages", ['body' => 'It is on the way.'],
            ['Idempotency-Key' => (string) Str::uuid()])->assertCreated()->assertJsonPath('message.sequence', 2);
        $this->actingAs($customer)->getJson("/api/v1/customer/logistics-conversations/{$id}/messages")
            ->assertOk()->assertJsonCount(2, 'data');
        $this->postJson("/api/v1/customer/logistics-conversations/{$id}/read", ['last_read_sequence' => 2])
            ->assertOk()->assertJsonPath('data.unread_count', 0);
        $this->postJson("/api/v1/customer/logistics-conversations/{$id}/read", ['last_read_sequence' => 1])
            ->assertOk()->assertJsonPath('data.last_read_sequence', 2);
        $this->actingAs($customer)->getJson("/api/v1/customer/conversations/{$id}")->assertNotFound();
        $this->assertDatabaseCount('conversations', 1);

        $order->update(['status' => OrderStatus::Delivered]);
        $this->getJson("/api/v1/customer/logistics-conversations/{$id}")
            ->assertOk()->assertJsonPath('data.send_allowed', false);
        $this->postJson("/api/v1/customer/logistics-conversations/{$id}/messages", ['body' => 'Again'],
            ['Idempotency-Key' => (string) Str::uuid()])->assertConflict();
    }

    public function test_customer_order_chat_follows_custody_without_transferring_history(): void
    {
        [$origin, , $task] = $this->finalTask();
        $order = $task->shipment->parcel->order;
        $order->update(['status' => OrderStatus::InTransit]);
        $customer = $order->customer;
        $start = ['context_type' => 'order', 'context_id' => $order->id, 'body' => 'Checking delivery'];
        $oldId = $this->actingAs($customer)->postJson('/api/v1/customer/logistics-conversations', $start,
            ['Idempotency-Key' => (string) Str::uuid()])->assertCreated()->json('conversation.id');
        $destination = $this->logistics();
        $task->shipment->update(['status' => 'in_transfer']);
        $this->postJson("/api/v1/customer/logistics-conversations/{$oldId}/messages", ['body' => 'Anyone there?'],
            ['Idempotency-Key' => (string) Str::uuid()])->assertConflict();
        $this->postJson('/api/v1/customer/logistics-conversations', $start,
            ['Idempotency-Key' => (string) Str::uuid()])->assertNotFound();

        $task->shipment->update(['status' => 'received_at_hub',
            'current_logistics_organization_id' => $destination->logisticsOrganization->id,
            'current_hub_id' => $destination->logisticsOrganization->hub->id]);
        $newId = $this->postJson('/api/v1/customer/logistics-conversations', $start,
            ['Idempotency-Key' => (string) Str::uuid()])->assertCreated()->json('conversation.id');
        $this->assertNotSame($oldId, $newId);
        $this->actingAs($destination)->getJson("/api/v1/logistics/operational-conversations/{$oldId}")->assertNotFound();
        $this->getJson("/api/v1/logistics/operational-conversations/{$newId}")->assertOk();
        $this->actingAs($origin)->getJson("/api/v1/logistics/operational-conversations/{$oldId}")
            ->assertOk()->assertJsonPath('data.send_allowed', false);
        $this->actingAs($customer)->getJson('/api/v1/customer/logistics-conversations')
            ->assertOk()->assertJsonCount(2, 'data');
    }

    public function test_logistics_can_initiate_only_for_its_current_handled_order(): void
    {
        [$logistics, , $task] = $this->finalTask();
        $order = $task->shipment->parcel->order;
        $order->update(['status' => OrderStatus::Assigned]);
        $customer = $order->customer;
        $input = ['context_type' => 'order', 'context_id' => $order->id, 'body' => 'Delivery update'];

        $this->actingAs($logistics)->postJson('/api/v1/logistics/operational-conversations',
            [...$input, 'customer_user_id' => $customer->id], ['Idempotency-Key' => (string) Str::uuid()])
            ->assertUnprocessable();
        $first = $this->postJson('/api/v1/logistics/operational-conversations', $input,
            ['Idempotency-Key' => (string) Str::uuid()])->assertCreated()
            ->assertJsonPath('conversation.kind', 'customer_logistics')
            ->assertJsonPath('conversation.counterparty_role', 'customer');
        $id = $first->json('conversation.id');
        $this->actingAs($customer)->postJson('/api/v1/customer/logistics-conversations',
            [...$input, 'body' => 'Thank you'], ['Idempotency-Key' => (string) Str::uuid()])
            ->assertCreated()->assertJsonPath('conversation.id', $id)
            ->assertJsonPath('message.sequence', 2);
        $this->assertDatabaseCount('conversations', 1);
    }

    public function test_seller_and_logistics_share_only_their_selected_pickup_thread(): void
    {
        [$logistics, , $task] = $this->finalTask();
        $order = $task->shipment->parcel->order;
        $pickup = $order->waybill->pickupRequest;
        $event = $order->statusEvents()->create(['from_status' => OrderStatus::Placed,
            'to_status' => OrderStatus::ReadyForPickup, 'source' => 'seller_pickup', 'occurred_at' => now()]);
        $pickup->orders()->create(['order_id' => $order->id, 'status_event_id' => $event->id, 'position' => 1]);
        $order->update(['status' => OrderStatus::ReadyForPickup]);
        $seller = $pickup->seller;
        $foreignSeller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
        $foreignLogistics = $this->logistics();
        $input = ['context_type' => 'pickup_request', 'context_id' => $pickup->id, 'body' => ' Please confirm pickup. '];
        $key = (string) Str::uuid();

        $this->postJson('/api/v1/seller/logistics-conversations', $input, ['Idempotency-Key' => $key])->assertUnauthorized();
        $this->actingAs($foreignSeller)->postJson('/api/v1/seller/logistics-conversations', $input,
            ['Idempotency-Key' => (string) Str::uuid()])->assertNotFound();
        $this->actingAs($foreignLogistics)->postJson('/api/v1/logistics/operational-conversations', $input,
            ['Idempotency-Key' => (string) Str::uuid()])->assertNotFound();
        $first = $this->actingAs($seller)->postJson('/api/v1/seller/logistics-conversations', $input,
            ['Idempotency-Key' => $key])->assertCreated()->assertJsonPath('conversation.kind', 'seller_logistics')
            ->assertJsonPath('message.body', 'Please confirm pickup.');
        $id = $first->json('conversation.id');
        $this->postJson('/api/v1/seller/logistics-conversations', $input, ['Idempotency-Key' => $key])
            ->assertOk()->assertJsonPath('conversation.id', $id);
        $this->postJson('/api/v1/seller/logistics-conversations', [...$input, 'body' => 'Changed'],
            ['Idempotency-Key' => $key])->assertConflict();
        $this->actingAs($logistics)->getJson('/api/v1/logistics/operational-conversations')
            ->assertOk()->assertJsonPath('data.0.unread_count', 1);
        $this->postJson('/api/v1/logistics/operational-conversations', $input,
            ['Idempotency-Key' => (string) Str::uuid()])->assertCreated()
            ->assertJsonPath('conversation.id', $id)->assertJsonPath('message.sequence', 2);
        $this->actingAs($seller)->getJson('/api/v1/seller/logistics-conversations')
            ->assertOk()->assertJsonPath('data.0.unread_count', 1);
        $this->postJson("/api/v1/seller/logistics-conversations/{$id}/read", ['last_read_sequence' => 2])
            ->assertOk()->assertJsonPath('data.unread_count', 0);
        $this->postJson("/api/v1/seller/logistics-conversations/{$id}/read", ['last_read_sequence' => 1])
            ->assertOk()->assertJsonPath('data.last_read_sequence', 2);
        $this->postJson("/api/v1/seller/logistics-conversations/{$id}/messages", ['body' => 'The parcels are ready.'],
            ['Idempotency-Key' => (string) Str::uuid()])->assertCreated()->assertJsonPath('message.sequence', 3);
        $this->getJson("/api/v1/seller/logistics-conversations/{$id}/messages?limit=2")
            ->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.1.body', 'The parcels are ready.')
            ->assertJsonStructure(['meta' => ['next_cursor']]);
        $this->actingAs($logistics)->getJson("/api/v1/logistics/operational-conversations/{$id}")
            ->assertOk()->assertJsonPath('data.unread_count', 2);
        $this->actingAs($foreignSeller)->getJson("/api/v1/seller/logistics-conversations/{$id}")->assertNotFound();
        $this->actingAs($foreignLogistics)->getJson("/api/v1/logistics/operational-conversations/{$id}")->assertNotFound();
        $this->actingAs($order->customer)->getJson("/api/v1/customer/logistics-conversations/{$id}")->assertNotFound();
        $this->actingAs($seller)->getJson("/api/v1/seller/conversations/{$id}")->assertNotFound();
        $order->update(['status' => OrderStatus::Delivered]);
        $this->getJson("/api/v1/seller/logistics-conversations/{$id}")
            ->assertOk()->assertJsonPath('data.send_allowed', false);
        $this->postJson("/api/v1/seller/logistics-conversations/{$id}/messages", ['body' => 'Too late'],
            ['Idempotency-Key' => (string) Str::uuid()])->assertConflict();
        $this->assertDatabaseCount('conversations', 1);
        $this->assertDatabaseCount('messages', 3);
    }

    public function test_accepted_final_mile_courier_and_buyer_share_only_their_task_thread(): void
    {
        [$logistics, $courier, $task] = $this->finalTask();
        $order = $task->shipment->parcel->order;
        $order->update(['status' => OrderStatus::Assigned]);
        $input = ['leg' => 'final_mile', 'task_id' => $task->id,
            'counterparty_role' => 'customer', 'body' => 'I will deliver your parcel today.'];

        $this->actingAs($courier)->postJson('/api/v1/courier/operational-conversations', $input,
            ['Idempotency-Key' => (string) Str::uuid()])->assertConflict();
        $task->update(['status' => FulfillmentTaskStatus::DeliveryAccepted]);
        $task->offers()->update(['status' => FulfillmentOfferStatus::Accepted]);
        $key = (string) Str::uuid();
        $first = $this->postJson('/api/v1/courier/operational-conversations', $input,
            ['Idempotency-Key' => $key])->assertCreated()->assertJsonPath('conversation.kind', 'courier_customer')
            ->assertJsonPath('conversation.counterparty_role', 'customer');
        $id = $first->json('conversation.id');
        $this->postJson('/api/v1/courier/operational-conversations', $input,
            ['Idempotency-Key' => $key])->assertOk()->assertJsonPath('conversation.id', $id);
        $this->postJson('/api/v1/courier/operational-conversations', [...$input, 'body' => 'Changed'],
            ['Idempotency-Key' => $key])->assertConflict()->assertJsonPath('code', 'IDEMPOTENCY_CONFLICT');
        $this->postJson('/api/v1/courier/operational-conversations', [
            ...$input, 'counterparty_role' => 'seller',
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertUnprocessable();
        $customer = $order->customer;
        $this->actingAs($customer)->getJson('/api/v1/customer/courier-conversations')
            ->assertOk()->assertJsonPath('data.0.unread_count', 1);
        $this->postJson('/api/v1/customer/courier-conversations', [
            'context_type' => 'order', 'context_id' => $order->id, 'body' => 'Thank you.',
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertCreated()
            ->assertJsonPath('conversation.id', $id)->assertJsonPath('message.sequence', 2);
        $this->actingAs($courier)->getJson('/api/v1/courier/operational-conversations')
            ->assertOk()->assertJsonPath('meta.unread_count', 1);
        $this->postJson("/api/v1/courier/operational-conversations/{$id}/read", ['last_read_sequence' => 2])
            ->assertOk()->assertJsonPath('data.unread_count', 0);
        $this->postJson("/api/v1/courier/operational-conversations/{$id}/read", ['last_read_sequence' => 1])
            ->assertOk()->assertJsonPath('data.last_read_sequence', 2);
        $this->getJson("/api/v1/courier/operational-conversations/{$id}/messages?limit=1")
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonStructure(['meta' => ['next_cursor']]);
        $this->actingAs($logistics)->getJson("/api/v1/logistics/operational-conversations/{$id}")->assertNotFound();
        $this->actingAs($order->shop->seller)->getJson("/api/v1/seller/courier-conversations/{$id}")->assertNotFound();
        $other = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $this->actingAs($other)->getJson("/api/v1/customer/courier-conversations/{$id}")->assertNotFound();
        $this->actingAs($customer)->getJson("/api/v1/customer/logistics-conversations/{$id}")->assertNotFound();
        $task->update(['status' => FulfillmentTaskStatus::Delivered]);
        $order->update(['status' => OrderStatus::Delivered]);
        $this->getJson("/api/v1/customer/courier-conversations/{$id}")
            ->assertOk()->assertJsonPath('data.send_allowed', false);
        $this->postJson("/api/v1/customer/courier-conversations/{$id}/messages", ['body' => 'Late'],
            ['Idempotency-Key' => (string) Str::uuid()])->assertConflict();
        $this->assertDatabaseCount('conversations', 1);
        $this->assertDatabaseCount('messages', 2);
    }

    public function test_accepted_first_mile_courier_and_seller_share_only_their_task_thread(): void
    {
        [$logistics, $courier, $final] = $this->finalTask();
        $shipment = $final->shipment;
        $order = $shipment->parcel->order;
        $order->update(['status' => OrderStatus::ReadyForPickup]);
        $schedule = PickupSchedule::create([
            'logistics_organization_id' => $shipment->logistics_organization_id,
            'logistics_hub_id' => $shipment->logistics_hub_id,
            'courier_id' => $courier->id,
            'reference' => 'PICK-'.Str::upper(Str::random(8)),
            'status' => 'scheduled',
            'starts_at' => now()->addHour(),
            'ends_at' => now()->addHours(2),
            'idempotency_key' => (string) Str::uuid(),
        ]);
        $legacy = FirstMileTask::create([
            'pickup_schedule_id' => $schedule->id, 'order_id' => $order->id,
            'waybill_id' => $order->waybill->id,
            'logistics_organization_id' => $shipment->logistics_organization_id,
            'logistics_hub_id' => $shipment->logistics_hub_id,
            'courier_id' => $courier->id,
            'status' => FirstMileTaskStatus::Assigned,
        ]);
        $task = DeliveryTask::create([
            'shipment_id' => $shipment->id,
            'leg' => FulfillmentTaskLeg::FirstMile,
            'status' => FulfillmentTaskStatus::SellerPickupAssigned,
            'courier_id' => $courier->id,
            'legacy_first_mile_task_id' => $legacy->id,
        ]);
        $input = ['leg' => 'first_mile', 'task_id' => $legacy->id,
            'counterparty_role' => 'seller', 'body' => 'I am heading to your Shop.'];
        $this->actingAs($courier)->postJson('/api/v1/courier/operational-conversations', $input,
            ['Idempotency-Key' => (string) Str::uuid()])->assertConflict();
        $this->postJson('/api/v1/courier/operational-conversations', [
            ...$input, 'counterparty_role' => 'customer',
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertUnprocessable();
        $legacy->update(['status' => FirstMileTaskStatus::Accepted]);
        $task->update(['status' => FulfillmentTaskStatus::SellerPickupAccepted]);
        $first = $this->postJson('/api/v1/courier/operational-conversations', $input,
            ['Idempotency-Key' => (string) Str::uuid()])->assertCreated()
            ->assertJsonPath('conversation.kind', 'courier_seller');
        $id = $first->json('conversation.id');
        $seller = $order->shop->seller;
        $this->actingAs($seller)->postJson('/api/v1/seller/courier-conversations', [
            'context_type' => 'order', 'context_id' => $order->id, 'body' => 'The parcel is ready.',
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertCreated()
            ->assertJsonPath('conversation.id', $id)->assertJsonPath('message.sequence', 2);
        $this->getJson('/api/v1/seller/courier-conversations')
            ->assertOk()->assertJsonPath('data.0.unread_count', 1);
        $this->actingAs($logistics)->getJson("/api/v1/logistics/operational-conversations/{$id}")->assertNotFound();
        $this->actingAs($order->customer)->getJson("/api/v1/customer/courier-conversations/{$id}")->assertNotFound();
        $legacy->update(['status' => FirstMileTaskStatus::PickedUp]);
        $task->update(['status' => FulfillmentTaskStatus::PickedUpFromSeller]);
        $this->actingAs($seller)->getJson("/api/v1/seller/courier-conversations/{$id}")
            ->assertOk()->assertJsonPath('data.send_allowed', false);
        $this->postJson("/api/v1/seller/courier-conversations/{$id}/messages", ['body' => 'Late'],
            ['Idempotency-Key' => (string) Str::uuid()])->assertConflict();
        $this->assertDatabaseCount('conversations', 1);
    }

    public function test_reassigned_final_mile_courier_cannot_inherit_buyer_thread(): void
    {
        [$logistics, $courier, $task] = $this->finalTask();
        $task->shipment->parcel->order->update(['status' => OrderStatus::Assigned]);
        $task->update(['status' => FulfillmentTaskStatus::DeliveryAccepted]);
        $task->offers()->update(['status' => FulfillmentOfferStatus::Accepted]);
        $input = ['leg' => 'final_mile', 'task_id' => $task->id,
            'counterparty_role' => 'customer', 'body' => 'Initial Courier message'];
        $oldId = $this->actingAs($courier)->postJson('/api/v1/courier/operational-conversations', $input,
            ['Idempotency-Key' => (string) Str::uuid()])->assertCreated()->json('conversation.id');

        $replacement = User::factory()->create(['role' => UserRole::Courier, 'status' => UserStatus::Active]);
        $replacement->courierLogisticsAffiliation()->create([
            'logistics_organization_id' => $task->shipment->logistics_organization_id,
            'logistics_hub_id' => $task->shipment->logistics_hub_id,
            'status' => CourierAffiliationStatus::Approved,
        ]);
        $task->update(['courier_id' => $replacement->id]);
        $task->offers()->create([
            'courier_id' => $replacement->id,
            'logistics_organization_id' => $task->shipment->logistics_organization_id,
            'offered_by_logistics_id' => $logistics->id,
            'sequence' => 2,
            'status' => FulfillmentOfferStatus::Accepted,
            'idempotency_key' => (string) Str::uuid(),
            'request_hash' => str_repeat('a', 64),
            'offered_at' => now(),
        ]);
        $this->actingAs($courier)->getJson("/api/v1/courier/operational-conversations/{$oldId}")
            ->assertOk()->assertJsonPath('data.send_allowed', false);
        $this->postJson("/api/v1/courier/operational-conversations/{$oldId}/messages", ['body' => 'Late'],
            ['Idempotency-Key' => (string) Str::uuid()])->assertConflict();
        $this->actingAs($replacement)->getJson("/api/v1/courier/operational-conversations/{$oldId}")
            ->assertNotFound();
        $newId = $this->postJson('/api/v1/courier/operational-conversations', $input,
            ['Idempotency-Key' => (string) Str::uuid()])->assertCreated()->json('conversation.id');
        $this->assertNotSame($oldId, $newId);
        $this->assertDatabaseCount('conversations', 2);
    }

    /** @return array{User, User, DeliveryTask} */
    private function finalTask(): array
    {
        $logistics = $this->logistics();
        $organization = $logistics->logisticsOrganization;
        $hub = $organization->hub;
        $courier = User::factory()->create(['role' => UserRole::Courier, 'status' => UserStatus::Active]);
        $courier->courierProfile()->create(['first_name' => 'Cora', 'last_name' => 'Rider', 'contact_number' => '09173333333', 'sex' => 'female', 'birth_date' => '1994-01-01']);
        $courier->courierLogisticsAffiliation()->create([
            'logistics_organization_id' => $organization->id, 'logistics_hub_id' => $hub->id,
            'status' => CourierAffiliationStatus::Approved,
        ]);
        $seller = User::factory()->create(['role' => UserRole::Seller, 'status' => UserStatus::Active]);
        $category = ShopCategory::create(['name' => 'General', 'slug' => 'general', 'status' => CategoryStatus::Active]);
        $shop = Shop::create(['seller_id' => $seller->id, 'shop_category_id' => $category->id, 'name' => 'Seller Shop', 'slug' => 'seller-shop', 'status' => ShopStatus::Active]);
        $customer = User::factory()->create(['role' => UserRole::Customer, 'status' => UserStatus::Active]);
        $quote = CheckoutQuote::create(['customer_id' => $customer->id, 'input_payload' => [], 'request_hash' => str_repeat('a', 64), 'state_hash' => str_repeat('b', 64), 'expires_at' => now()->addHour()]);
        $batch = CheckoutBatch::create(['customer_id' => $customer->id, 'checkout_quote_id' => $quote->id, 'idempotency_key' => (string) Str::uuid(), 'request_hash' => str_repeat('c', 64), 'currency' => 'PHP', 'placed_at' => now()]);
        $order = Order::create(['checkout_batch_id' => $batch->id, 'customer_id' => $customer->id, 'shop_id' => $shop->id,
            'reference' => 'MSG-'.Str::upper(Str::random(8)), 'status' => OrderStatus::Placed,
            'payment_method' => PaymentMethod::CashOnDelivery, 'payment_status' => PaymentStatus::Pending,
            'currency' => 'PHP', 'merchandise_subtotal' => '100.00', 'shipping_fee' => '0.00', 'payable_total' => '100.00', 'placed_at' => now()]);
        $request = SellerPickupRequest::create(['shop_id' => $shop->id, 'seller_id' => $seller->id,
            'logistics_organization_id' => $organization->id, 'logistics_hub_id' => $hub->id,
            'status' => 'scheduled', 'idempotency_key' => (string) Str::uuid()]);
        $waybill = Waybill::create(['order_id' => $order->id, 'seller_pickup_request_id' => $request->id,
            'shop_id' => $shop->id, 'logistics_organization_id' => $organization->id, 'logistics_hub_id' => $hub->id,
            'reference' => 'WB-'.Str::upper(Str::random(8)), 'qr_token_hash' => str_repeat('d', 64), 'content_checksum' => str_repeat('e', 64)]);
        $parcel = Parcel::create(['order_id' => $order->id, 'waybill_id' => $waybill->id,
            'reference' => 'P-'.Str::upper(Str::random(8)), 'snapshot' => []]);
        $shipment = Shipment::create(['parcel_id' => $parcel->id, 'logistics_organization_id' => $organization->id,
            'logistics_hub_id' => $hub->id, 'status' => 'delivery_assigned']);
        $task = DeliveryTask::create(['shipment_id' => $shipment->id, 'leg' => FulfillmentTaskLeg::FinalMile,
            'status' => FulfillmentTaskStatus::DeliveryAssigned, 'courier_id' => $courier->id]);
        $task->offers()->create(['courier_id' => $courier->id, 'logistics_organization_id' => $organization->id,
            'offered_by_logistics_id' => $logistics->id, 'sequence' => 1, 'status' => FulfillmentOfferStatus::Offered,
            'idempotency_key' => (string) Str::uuid(), 'request_hash' => str_repeat('f', 64), 'offered_at' => now()]);

        return [$logistics, $courier, $task];
    }

    private function logistics(): User
    {
        $user = User::factory()->create(['role' => UserRole::Logistics, 'status' => UserStatus::Active]);
        $address = $user->addresses()->create(['type' => AddressType::Both, 'label' => 'Hub', 'recipient_name' => 'Operator',
            'contact_number' => '09172222222', 'address_line_1' => '1 Hub Road', 'barangay' => 'Poblacion',
            'city_municipality' => 'Manila', 'province' => 'Metro Manila', 'region' => 'NCR',
            'postal_code' => '1000', 'country' => 'PH', 'is_default' => true]);
        $organization = $user->logisticsOrganization()->create(['business_name' => 'Aisley Logistics']);
        $organization->hub()->create(['address_id' => $address->id, 'name' => 'Aisley Hub']);

        return $user;
    }
}
