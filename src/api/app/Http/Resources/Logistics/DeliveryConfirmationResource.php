<?php

namespace App\Http\Resources\Logistics;

use App\Enums\DeliveryApprovalMode;
use App\Enums\PaymentMethod;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DeliveryConfirmationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $task = $this->task;
        $shipment = $task->shipment;
        $order = $shipment->parcel->order;
        $intent = $task->completionIntents->where('shipment_evidence_id', $this->id)->sortByDesc('confirmed_at')->first();
        $profile = $task->courier?->courierProfile;
        $reviewer = $this->validatedBy?->logisticsProfile;
        $destination = $order->address;

        return [
            'task_id' => $task->id, 'task_revision' => $task->revision,
            'shipment_id' => $shipment->id, 'shipment_revision' => $shipment->revision,
            'shipment_reference' => $shipment->parcel->waybill?->reference ?? $order->reference,
            'order' => ['id' => $order->id, 'reference' => $order->reference, 'payment_method' => $order->payment_method->value, 'payment_status' => $order->payment_status->value],
            'destination' => $destination ? ['recipient_name' => $destination->recipient_name,
                'address' => implode(', ', array_filter([$destination->address_line_1, $destination->address_line_2, $destination->barangay, $destination->city_municipality, $destination->province]))] : null,
            'proof' => ['id' => $this->id, 'status' => $this->status->value, 'submitted_at' => $this->submitted_at?->toISOString()],
            'courier' => ['id' => $task->courier_id, 'name' => trim(implode(' ', array_filter([$profile?->first_name, $profile?->last_name])))],
            'cod' => $order->payment_method === PaymentMethod::CashOnDelivery && $intent ? [
                'collected' => $intent->cod_declared_at !== null, 'declared_amount' => $intent->cod_declared_amount,
                'currency' => $intent->cod_currency, 'declared_at' => $intent->cod_declared_at?->toISOString(),
            ] : null,
            'intent' => $intent ? ['id' => $intent->id, 'status' => $intent->status->value,
                'confirmed_at' => $intent->confirmed_at->toISOString(), 'expected_revision' => $intent->expected_revision,
                'approval_mode' => $intent->approval_mode->value, 'automatic_review_error' => $intent->automatic_review_error] : null,
            'review' => ['method' => $this->review_method?->value,
                'reviewer' => $this->review_method === DeliveryApprovalMode::Automatic ? 'System' : ($this->validated_by_logistics_id ? (trim(implode(' ', array_filter([$reviewer?->first_name, $reviewer?->last_name]))) ?: 'Logistics') : null),
                'reviewed_at' => $this->validated_at?->toISOString(), 'reason' => $this->rejection_reason],
        ];
    }
}
