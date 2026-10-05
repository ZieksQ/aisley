<?php

namespace Tests\Support;

use App\Models\CompletionIntent;
use App\Models\ShipmentEvidence;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

trait DeliveryReviewFixtures
{
    use CreatesOperationalMessagingContext;

    private function readyDelivery(bool $prepaid = false): array
    {
        Queue::fake();
        $disk = 'pod-review-'.getmypid();
        Storage::fake($disk);
        config(['filesystems.default' => $disk, 'hub-routing.enabled' => false]);
        [$logistics, $courier, $task] = $this->finalTask();
        $task->update(['status' => 'out_for_delivery', 'revision' => 5]);
        $task->shipment->update(['status' => 'out_for_delivery', 'revision' => 5]);
        $task->shipment->parcel->order->update(['status' => 'out_for_delivery', 'payment_method' => $prepaid ? 'prepaid' : 'cod', 'payment_status' => $prepaid ? 'paid' : 'pending']);
        $task->offers()->update(['status' => 'accepted']);
        $proof = $this->actingAs($courier)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->post('/api/v1/courier/tasks/'.$task->id.'/proof-of-delivery', [
                'photo' => UploadedFile::fake()->image('door.jpg'), 'expected_revision' => 5,
            ])->assertStatus(202)->json('data');

        return [$logistics, $courier, $task->fresh(), ShipmentEvidence::findOrFail($proof['proof_id'])];
    }

    private function submitIntent($courier, $task, $proof, bool $cod = true): CompletionIntent
    {
        $result = $this->actingAs($courier)->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/v1/courier/tasks/'.$task->id.'/completion', [
                'evidence_id' => $proof->id, 'expected_revision' => $task->revision, 'confirmed' => true,
                ...($cod ? ['cod_collected' => true] : []),
            ])->assertStatus(202)->json('data');

        return CompletionIntent::findOrFail($result['intent_id']);
    }

    private function approveDelivery($logistics, $task, $proof, ?string $key = null): void
    {
        $this->actingAs($logistics)->withHeader('Idempotency-Key', $key ?? (string) Str::uuid())
            ->postJson('/api/v1/logistics/update-status/transitions', [
                'reference' => $task->shipment->parcel->waybill->reference, 'target_state' => 'delivered',
                'expected_revision' => 5, 'evidence_id' => $proof->id,
            ])->assertOk()->assertJsonPath('data.status', 'delivered');
    }
}
