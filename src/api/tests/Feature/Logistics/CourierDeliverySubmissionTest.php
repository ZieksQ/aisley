<?php

namespace Tests\Feature\Logistics;

use App\Models\CompletionIntent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\Support\DeliveryReviewFixtures;
use Tests\TestCase;

class CourierDeliverySubmissionTest extends TestCase
{
    use DeliveryReviewFixtures, RefreshDatabase;

    public function test_photo_and_delivery_submission_appears_in_the_owning_logistics_queue_once(): void
    {
        Storage::fake('local');
        [$logistics, $courier, $task, $proof] = $this->readyDelivery();
        $this->actingAs($logistics)->getJson('/api/v1/logistics/delivery-confirmations')->assertOk()->assertJsonCount(0, 'data');
        $key = (string) Str::uuid();
        $body = ['evidence_id' => $proof->id, 'expected_revision' => $task->revision, 'confirmed' => true, 'cod_collected' => true];
        $receipt = $this->actingAs($courier)->withHeader('Idempotency-Key', $key)
            ->postJson('/api/v1/courier/tasks/'.$task->id.'/completion', $body)->assertStatus(202)->json('data');
        $this->postJson('/api/v1/courier/tasks/'.$task->id.'/completion', $body)->assertStatus(202)->assertJsonPath('data.intent_id', $receipt['intent_id']);
        $this->assertSame(1, CompletionIntent::where('delivery_task_id', $task->id)->count());
        $this->actingAs($logistics)->getJson('/api/v1/logistics/delivery-confirmations?view=pending')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.task_id', $task->id)
            ->assertJsonPath('data.0.proof.id', $proof->id)->assertJsonPath('data.0.intent.id', $receipt['intent_id'])
            ->assertJsonPath('data.0.cod.collected', true);
        $this->get('/api/v1/logistics/delivery-proofs/'.$proof->id.'/photo')->assertOk();
        $foreign = $this->logistics();
        $this->actingAs($foreign)->getJson('/api/v1/logistics/delivery-confirmations')->assertOk()->assertJsonCount(0, 'data');
        $this->get('/api/v1/logistics/delivery-proofs/'.$proof->id.'/photo')->assertNotFound();
        $this->approveDelivery($logistics, $task, $proof);
        $this->getJson('/api/v1/logistics/delivery-confirmations')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/logistics/delivery-confirmations?view=history')->assertOk()->assertJsonPath('data.0.proof.id', $proof->id);
    }
}
