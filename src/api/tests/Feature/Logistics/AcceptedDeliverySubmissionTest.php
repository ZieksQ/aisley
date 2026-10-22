<?php

namespace Tests\Feature\Logistics;

use App\Models\CompletionIntent;
use App\Models\ShipmentEvent;
use App\Models\ShipmentEvidence;
use App\Models\User;
use App\Services\Logistics\AutomaticDeliveryApprovalService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\DeliveryReviewFixtures;
use Tests\TestCase;

class AcceptedDeliverySubmissionTest extends TestCase
{
    use DeliveryReviewFixtures, RefreshDatabase;

    public function test_accept_then_delivered_enters_logistics_queue_without_pickup_or_transit_actions(): void
    {
        [$logistics, $courier, $task] = $this->acceptedDelivery();
        $revision = $task->revision;
        $uploadKey = (string) Str::uuid();
        $photo = UploadedFile::fake()->image('parcel.jpg');
        $upload = ['photo' => $photo, 'expected_revision' => $revision];
        $proofId = $this->actingAs($courier)->withHeader('Idempotency-Key', $uploadKey)
            ->post('/api/v1/courier/tasks/'.$task->id.'/proof-of-delivery', $upload)
            ->assertStatus(202)->assertJsonPath('data.custody_state', 'delivery_accepted')->json('data.proof_id');
        $this->post('/api/v1/courier/tasks/'.$task->id.'/proof-of-delivery', $upload)
            ->assertStatus(202)->assertJsonPath('data.proof_id', $proofId);
        $this->actingAs($logistics)->getJson('/api/v1/logistics/delivery-confirmations')->assertOk()->assertJsonCount(0, 'data');
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/logistics/update-status/transitions', [
                'reference' => $task->shipment->parcel->waybill->reference, 'target_state' => 'delivered',
                'expected_revision' => $task->shipment->fresh()->revision, 'evidence_id' => $proofId,
            ])->assertStatus(409)->assertJsonPath('code', 'COMPLETION_INTENT_REQUIRED');

        $body = ['evidence_id' => $proofId, 'expected_revision' => $revision, 'confirmed' => true];
        $this->actingAs($courier)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/courier/tasks/'.$task->id.'/completion', $body)
            ->assertStatus(422)->assertJsonPath('code', 'COD_COLLECTION_REQUIRED');
        $body['cod_collected'] = true;
        $key = (string) Str::uuid();
        $intentId = $this->withHeader('Idempotency-Key', $key)
            ->postJson('/api/v1/courier/tasks/'.$task->id.'/completion', $body)
            ->assertStatus(202)->assertJsonPath('data.task_status', 'delivery_accepted')->json('data.intent_id');
        $this->postJson('/api/v1/courier/tasks/'.$task->id.'/completion', $body)
            ->assertStatus(202)->assertJsonPath('data.intent_id', $intentId);
        $this->assertSame(1, CompletionIntent::where('delivery_task_id', $task->id)->count());
        $this->assertSame($revision, $task->fresh()->revision);
        $this->assertSame('assigned', $task->shipment->parcel->order->fresh()->status->value);
        $this->assertSame('pending', $task->shipment->parcel->order->fresh()->payment_status->value);
        $this->assertNull($task->fresh()->picked_up_at);
        $this->assertDatabaseMissing('shipment_evidence', ['purpose' => 'hub_pickup', 'delivery_task_id' => $task->id]);

        $this->actingAs($logistics)->getJson('/api/v1/logistics/delivery-confirmations')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.task_id', $task->id)
            ->assertJsonPath('data.0.proof.id', $proofId)->assertJsonPath('data.0.intent.id', $intentId);
        $this->get('/api/v1/logistics/delivery-proofs/'.$proofId.'/photo')->assertOk();
        $foreign = $this->logistics();
        $this->actingAs($foreign)->getJson('/api/v1/logistics/delivery-confirmations')->assertOk()->assertJsonCount(0, 'data');
        $this->get('/api/v1/logistics/delivery-proofs/'.$proofId.'/photo')->assertNotFound();
        $approval = ['reference' => $task->shipment->parcel->waybill->reference, 'target_state' => 'delivered',
            'expected_revision' => $task->shipment->fresh()->revision, 'evidence_id' => $proofId];
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/logistics/update-status/transitions', $approval)->assertNotFound();
        $this->actingAs($logistics)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/logistics/update-status/transitions', $approval)->assertOk()->assertJsonPath('data.status', 'delivered');
        $this->assertSame('delivered', $task->fresh()->status->value);
        $this->assertSame('delivered', $task->shipment->fresh()->status->value);
        $this->assertSame('delivered', $task->shipment->parcel->order->fresh()->status->value);
        $this->assertSame('paid', $task->shipment->parcel->order->fresh()->payment_status->value);
        $this->assertSame('delivery_accepted', ShipmentEvent::where('event_type', 'delivery_completed')->sole()->from_state);
        $this->getJson('/api/v1/logistics/delivery-confirmations')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/logistics/delivery-confirmations?view=history')->assertOk()->assertJsonPath('data.0.proof.id', $proofId);
        $this->actingAs($courier)->getJson('/api/v1/courier/tasks/'.$task->id.'/completion')
            ->assertOk()->assertJsonPath('data.task_status', 'delivered')->assertJsonPath('data.completion_status', 'validated');
    }

    public function test_unaccepted_foreign_and_stale_tasks_cannot_submit_delivery_proof_or_intent(): void
    {
        [$logistics, $courier, $task] = $this->acceptedDelivery();
        $proof = $this->uploadProof($courier, $task);
        $foreign = User::factory()->create(['role' => 'courier', 'status' => 'active']);
        $foreign->courierProfile()->create(['first_name' => 'Other', 'last_name' => 'Courier', 'contact_number' => '09174444444', 'sex' => 'male', 'birth_date' => '1994-01-01']);
        $foreign->courierLogisticsAffiliation()->create([
            'logistics_organization_id' => $logistics->logisticsOrganization->id,
            'logistics_hub_id' => $logistics->logisticsOrganization->hub->id, 'status' => 'approved',
        ]);
        $body = ['evidence_id' => $proof->id, 'expected_revision' => $task->revision, 'confirmed' => true, 'cod_collected' => true];
        $this->actingAs($foreign)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->post('/api/v1/courier/tasks/'.$task->id.'/proof-of-delivery', [
                'photo' => UploadedFile::fake()->image('parcel.jpg'), 'expected_revision' => $task->revision,
            ])->assertNotFound();
        $this->postJson('/api/v1/courier/tasks/'.$task->id.'/completion', $body)->assertNotFound();
        $task->update(['revision' => $task->revision + 1]);
        $this->actingAs($courier)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/courier/tasks/'.$task->id.'/completion', $body)->assertStatus(409);
        $task->update(['status' => 'delivery_assigned']);
        $body['expected_revision'] = $task->revision;
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/courier/tasks/'.$task->id.'/completion', $body)->assertStatus(409);
        $this->post('/api/v1/courier/tasks/'.$task->id.'/proof-of-delivery', [
            'photo' => UploadedFile::fake()->image('parcel.jpg'), 'expected_revision' => $task->revision,
        ])->assertStatus(409);
        $this->actingAs($logistics)->getJson('/api/v1/logistics/delivery-confirmations')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_correction_and_failed_attempt_remain_available_after_acceptance(): void
    {
        [$logistics, $courier, $task] = $this->acceptedDelivery();
        $oldProof = $this->uploadProof($courier, $task);
        $this->actingAs($courier)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/courier/final-mile-tasks/'.$task->id.'/failed-attempts', [
                'reason' => 'recipient_unavailable', 'expected_revision' => $task->revision,
            ])->assertStatus(201);
        $body = ['evidence_id' => $oldProof->id, 'expected_revision' => $task->revision, 'confirmed' => true, 'cod_collected' => true];
        $this->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/courier/tasks/'.$task->id.'/completion', $body)
            ->assertStatus(409)->assertJsonPath('code', 'PROOF_STALE_AFTER_FAILED_ATTEMPT');
        $proof = $this->uploadProof($courier, $task);
        $intent = $this->submitIntent($courier, $task, $proof);
        $this->actingAs($logistics)->postJson('/api/v1/logistics/delivery-proofs/'.$proof->id.'/reject', [
            'expected_revision' => $task->revision, 'reason' => 'Photo is unclear',
        ])->assertOk();
        $this->assertSame('delivery_accepted', $task->fresh()->status->value);
        $this->assertSame('rejected', $intent->fresh()->status->value);
        $this->getJson('/api/v1/logistics/delivery-confirmations')->assertOk()->assertJsonCount(0, 'data');
        $replacement = $this->uploadProof($courier, $task);
        $this->submitIntent($courier, $task, $replacement);
        $this->actingAs($logistics)->getJson('/api/v1/logistics/delivery-confirmations')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.proof.id', $replacement->id);
    }

    #[DataProvider('existingDeliveryStates')]
    public function test_existing_in_progress_parcels_can_submit_and_be_confirmed(string $status, string $orderStatus): void
    {
        [$logistics, $courier, $task] = $this->acceptedDelivery();
        $task->update(['status' => $status]);
        $task->shipment->update(['status' => $status]);
        $task->shipment->parcel->order->update(['status' => $orderStatus]);
        $proof = $this->uploadProof($courier, $task);
        $this->submitIntent($courier, $task, $proof);
        $this->actingAs($logistics)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/logistics/update-status/transitions', [
                'reference' => $task->shipment->parcel->waybill->reference, 'target_state' => 'delivered',
                'expected_revision' => $task->shipment->fresh()->revision, 'evidence_id' => $proof->id,
            ])->assertOk()->assertJsonPath('data.status', 'delivered');
    }

    public static function existingDeliveryStates(): array
    {
        return [['picked_up_from_hub', 'assigned'], ['in_transit', 'in_transit'], ['out_for_delivery', 'out_for_delivery']];
    }

    public function test_accepted_paid_prepaid_delivery_retains_automatic_approval_policy(): void
    {
        [$logistics, $courier, $task] = $this->acceptedDelivery();
        $task->shipment->parcel->order->update(['payment_method' => 'prepaid', 'payment_status' => 'paid']);
        $logistics->logisticsOrganization->update(['delivery_approval_mode' => 'automatic']);
        $proof = $this->uploadProof($courier, $task);
        $intent = $this->submitIntent($courier, $task, $proof, false);
        app(AutomaticDeliveryApprovalService::class)->approve($intent->id);
        $this->assertSame('delivered', $task->fresh()->status->value);
        $this->assertSame('automatic', $proof->fresh()->review_method->value);
        $this->assertNull($proof->fresh()->validated_by_logistics_id);
        $this->assertDatabaseCount('courier_cash_obligations', 0);
    }

    private function acceptedDelivery(): array
    {
        Storage::fake('local');
        Queue::fake();
        config(['hub-routing.enabled' => false]);
        [$logistics, $courier, $task] = $this->finalTask();
        $task->shipment->parcel->order->update(['status' => 'assigned']);
        $this->actingAs($courier)->postJson('/api/v1/courier/final-mile-tasks/'.$task->id.'/accept')
            ->assertOk()->assertJsonPath('data.status', 'delivery_accepted');

        return [$logistics, $courier, $task->fresh()];
    }

    private function uploadProof($courier, $task): ShipmentEvidence
    {
        $proof = $this->actingAs($courier)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->post('/api/v1/courier/tasks/'.$task->id.'/proof-of-delivery', [
                'photo' => UploadedFile::fake()->image('parcel.jpg'), 'expected_revision' => $task->revision,
            ])->assertStatus(202)->json('data.proof_id');

        return ShipmentEvidence::findOrFail($proof);
    }
}
