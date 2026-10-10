<?php

namespace Tests\Support;

use App\Models\CompletionIntent;
use App\Models\DeliveryTask;
use App\Models\Order;
use App\Models\ShipmentEvidence;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

trait LegacyShippingVoucherDeliveryFixtures
{
    use LegacyShippingVoucherFixtures;

    /** Drive a real funded checkout through custody, photo upload and Courier intent. */
    private function pendingLegacyDelivery(string $saving): array
    {
        $context = $this->legacyContext();
        $disk = 'legacy-voucher-delivery-'.getmypid();
        Storage::fake($disk);
        config(['filesystems.default' => $disk]);
        $voucher = $this->legacyVoucher($context, ['value' => $saving]);
        $intent = $this->legacyIntent($context, [$voucher]);
        $quote = $this->postJson('/api/v1/customer/checkout/quote', $intent)->assertOk()->json('data');
        $placed = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/customer/checkout/place', [...$intent, 'quote_id' => $quote['quoteId']])->assertOk()->json('data');
        $order = Order::findOrFail($placed['orders'][0]['id']);
        $this->asLifecycleActor($context['seller']);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/seller/orders/'.$order->id.'/approve')->assertOk();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/seller/orders/pickup-requests', [
            'order_ids' => [$order->id], 'pickup_address_id' => $context['seller']->addresses()->where('label', 'Pickup')->sole()->id,
            'logistics_organization_id' => $context['origin'][1]->id,
        ])->assertOk();
        $order->refresh()->load('waybill');
        $reference = $order->waybill->reference;
        $this->asLifecycleActor($context['origin'][0]);
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/pickup-schedules', [
            'order_ids' => [$order->id], 'courier_id' => $context['firstCourier']->id,
            'starts_at' => now()->addHours(3)->toISOString(), 'ends_at' => now()->addHours(4)->toISOString(),
        ])->assertCreated();
        $this->asLifecycleActor($context['firstCourier']);
        $first = $this->getJson('/api/v1/courier/first-mile-tasks')->assertOk()->json('data.0');
        $this->postJson('/api/v1/courier/first-mile-tasks/'.$first['id'].'/accept')->assertOk();
        $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/courier/first-mile-tasks/'.$first['id'].'/pickup', [
            'identifier_type' => 'tracking_id', 'identifier' => $reference,
        ])->assertOk();
        $this->asLifecycleActor($context['origin'][0]);
        $this->postJson('/api/v1/logistics/receiving/batches', ['receipts' => [[
            'client_id' => (string) Str::uuid(), 'reference' => $reference, 'scanned_at' => now()->toISOString(),
        ]]])->assertOk();
        $session = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/sorting/sessions')->assertCreated()->json('data');
        $this->postJson('/api/v1/logistics/sorting/sessions/'.$session['id'].'/batches', ['captures' => [[
            'client_id' => (string) Str::uuid(), 'reference' => $reference, 'auto_route' => true,
            'expected_revision' => $session['items'][0]['expected_revision'], 'source' => 'barcode', 'captured_at' => now()->toISOString(),
        ]]])->assertOk()->assertJsonPath('summary.sorted', 1);
        $record = $this->getJson('/api/v1/logistics/update-status/records/'.$reference)->assertOk()->json('data');
        $schedule = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/dispatch/schedules', [
            'shipment_ids' => [$record['shipment_id']], 'courier_id' => $context['finalCourier']->id, 'scheduled_for' => now()->addHour()->toISOString(),
            'assignments' => [[
                'shipment_id' => $record['shipment_id'], 'expected_revision' => $record['revision'],
                'lane_id' => $record['sorting_lane']['id'], 'lane_revision' => $record['sorting_lane']['revision'],
            ]],
        ])->assertCreated()->json('data');
        $this->asLifecycleActor($context['finalCourier']);
        $batch = $this->postJson('/api/v1/courier/final-mile-batches/'.$schedule['id'].'/accept')->assertOk()->json('data');
        $final = $batch['tasks'][0];
        $hubEvidence = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/courier/final-mile-tasks/'.$final['task_id'].'/pickup', ['expected_revision' => $final['revision']])->assertStatus(202)->json('data');
        $this->asLifecycleActor($context['origin'][0]);
        $record = $this->getJson('/api/v1/logistics/update-status/records/'.$reference)->assertOk()->json('data');
        $record = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/logistics/update-status/transitions', [
            'reference' => $reference, 'target_state' => 'picked_up_from_hub', 'expected_revision' => $record['revision'], 'evidence_id' => $hubEvidence['evidence_id'],
        ])->assertOk()->json('data');
        $final = collect($record['tasks'])->firstWhere('leg', 'final_mile');
        $this->asLifecycleActor($context['finalCourier']);
        foreach (['in_transit', 'out_for_delivery'] as $state) {
            $final = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/courier/final-mile-tasks/'.$final['task_id'].'/status', [
                'target_state' => $state, 'expected_revision' => $final['revision'],
            ])->assertOk()->json('data');
        }
        $proof = $this->withHeader('Idempotency-Key', (string) Str::uuid())->post('/api/v1/courier/tasks/'.$final['task_id'].'/proof-of-delivery', [
            'photo' => UploadedFile::fake()->image('legacy-door.jpg'), 'expected_revision' => $final['revision'],
        ])->assertStatus(202)->json('data');
        $completion = $this->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/courier/tasks/'.$final['task_id'].'/completion', [
            'expected_revision' => $final['revision'], 'evidence_id' => $proof['proof_id'], 'confirmed' => true, 'cod_collected' => true,
        ])->assertStatus(202)->json('data');
        $this->asLifecycleActor($context['origin'][0]);
        $record = $this->getJson('/api/v1/logistics/update-status/records/'.$reference)->assertOk()->json('data');

        return [
            ...$context, 'order' => $order->fresh(), 'voucher' => $voucher,
            'task' => DeliveryTask::findOrFail($final['task_id']), 'proof' => ShipmentEvidence::findOrFail($proof['proof_id']),
            'completion' => CompletionIntent::findOrFail($completion['intent_id']),
            'approval' => ['reference' => $reference, 'target_state' => 'delivered', 'expected_revision' => $record['revision'], 'evidence_id' => $proof['proof_id']],
        ];
    }
}
