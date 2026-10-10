<?php

namespace Tests\Support;

use App\Models\DeliveryTask;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

trait FailedAttemptFixtures
{
    use DeliveryReviewFixtures;

    /** @return array{User, DeliveryTask} */
    private function failedAttemptTask(): array
    {
        Queue::fake();
        config(['hub-routing.enabled' => false]);
        [, $courier, $task] = $this->finalTask();
        $task->update(['status' => 'out_for_delivery', 'revision' => 5]);
        $task->shipment->update(['status' => 'out_for_delivery', 'revision' => 5]);
        $task->shipment->parcel->order->update(['status' => 'out_for_delivery']);
        $task->offers()->update(['status' => 'accepted']);

        return [$courier, $task->fresh()];
    }

    private function anotherFailedAttemptTask(DeliveryTask $task, ?User $courier = null): DeliveryTask
    {
        $parcel = $task->shipment->parcel;
        $order = $parcel->order->replicate();
        $batch = $parcel->order->batch->replicate();
        $quote = $batch->quote->replicate();
        $quote->save();
        $batch->checkout_quote_id = $quote->id;
        $batch->idempotency_key = (string) Str::uuid();
        $batch->save();
        $order->checkout_batch_id = $batch->id;
        $order->reference = 'ATTEMPT-'.Str::upper(Str::random(8));
        $order->save();
        $waybill = $parcel->waybill->replicate();
        $waybill->order_id = $order->id;
        $waybill->reference = 'WB-'.Str::upper(Str::random(8));
        $waybill->qr_token_hash = hash('sha256', (string) Str::uuid());
        $waybill->save();
        $newParcel = $parcel->replicate();
        $newParcel->order_id = $order->id;
        $newParcel->waybill_id = $waybill->id;
        $newParcel->reference = 'P-'.Str::upper(Str::random(8));
        $newParcel->save();
        $shipment = $task->shipment->replicate();
        $shipment->parcel_id = $newParcel->id;
        $shipment->save();
        $next = $task->replicate();
        $next->shipment_id = $shipment->id;
        $next->courier_id = $courier?->id ?? $task->courier_id;
        $next->save();

        return $next;
    }

    private function anotherAttemptCourier(User $courier): User
    {
        $next = User::factory()->create(['role' => $courier->role, 'status' => $courier->status]);
        $profile = $courier->courierProfile->replicate();
        $profile->user_id = $next->id;
        $profile->save();
        $affiliation = $courier->courierLogisticsAffiliation->replicate();
        $affiliation->courier_id = $next->id;
        $affiliation->save();

        return $next;
    }

    private function attemptInput(): array
    {
        return ['reason' => 'recipient_unavailable', 'note' => 'No answer at the door.', 'expected_revision' => 5];
    }

    private function attemptState(DeliveryTask $task): array
    {
        $task = $task->fresh();
        $tables = ['shipment_events', 'completion_intents', 'shipment_evidence', 'order_status_events',
            'notifications', 'courier_cash_obligations', 'cod_invoices', 'finance_journal_entries'];

        return [
            'task' => $task->getAttributes(),
            'shipment' => $task->shipment->getAttributes(),
            'order' => $task->shipment->parcel->order->getAttributes(),
            'counts' => array_map(fn ($table) => DB::table($table)->count(), $tables),
        ];
    }
}
