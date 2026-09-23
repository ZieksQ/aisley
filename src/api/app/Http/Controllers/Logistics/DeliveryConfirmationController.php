<?php

namespace App\Http\Controllers\Logistics;

use App\Enums\FulfillmentTaskLeg;
use App\Enums\FulfillmentTaskStatus;
use App\Enums\PaymentMethod;
use App\Enums\ShipmentEvidenceStatus;
use App\Models\CompletionIntent;
use App\Models\DeliveryTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeliveryConfirmationController
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['sometimes', 'string', 'max:120'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);
        $organization = $request->user()->logisticsOrganization()->with('hub')->firstOrFail();
        $hub = $organization->hub;

        $query = DeliveryTask::query()
            ->where('leg', FulfillmentTaskLeg::FinalMile->value)
            ->where('status', FulfillmentTaskStatus::OutForDelivery->value)
            ->whereHas('shipment', fn ($shipment) => $shipment->where('current_logistics_organization_id', $organization->id)->where('current_hub_id', $hub->id))
            ->whereHas('completionIntents', fn ($intent) => $intent->where('status', ShipmentEvidenceStatus::AwaitingValidation->value)
                ->whereHas('evidence', fn ($evidence) => $evidence->where('status', ShipmentEvidenceStatus::AwaitingValidation->value)->where('purpose', 'delivery_proof')->where('type', 'photo')))
            ->with(['shipment.parcel.order', 'shipment.parcel.waybill', 'courier.courierProfile', 'completionIntents.evidence']);

        if (! empty($validated['search'])) {
            $search = trim($validated['search']);
            $query->whereHas('shipment.parcel.order', fn ($order) => $order->whereRaw('LOWER(reference) LIKE ?', ['%'.mb_strtolower($search).'%']));
        }

        $page = $query->orderBy('updated_at')->orderBy('id')->paginate((int) ($validated['per_page'] ?? 20));
        $data = collect($page->items())->map(function (DeliveryTask $task): array {
            $intent = $task->completionIntents->filter(fn (CompletionIntent $item): bool => $item->status === ShipmentEvidenceStatus::AwaitingValidation && $item->evidence?->status === ShipmentEvidenceStatus::AwaitingValidation)
                ->sortByDesc('confirmed_at')->first();
            if ($intent === null) {
                return [];
            }
            $order = $task->shipment->parcel->order;
            $courier = $task->courier;

            return [
                'task_id' => $task->id,
                'task_revision' => $task->revision,
                'shipment_id' => $task->shipment->id,
                'shipment_revision' => $task->shipment->revision,
                'shipment_reference' => $task->shipment->parcel->waybill?->reference ?? $order->reference,
                'order' => ['id' => $order->id, 'reference' => $order->reference, 'payment_method' => $order->payment_method->value, 'payment_status' => $order->payment_status->value],
                'proof' => ['id' => $intent->shipment_evidence_id, 'status' => $intent->evidence->status->value, 'submitted_at' => $intent->evidence->submitted_at?->toISOString()],
                'courier' => ['id' => $courier->id, 'name' => trim(implode(' ', array_filter([$courier->courierProfile?->first_name, $courier->courierProfile?->last_name])))],
                'cod' => $order->payment_method === PaymentMethod::CashOnDelivery ? [
                    'collected' => $intent->cod_declared_at !== null,
                    'declared_amount' => $intent->cod_declared_amount,
                    'currency' => $intent->cod_currency,
                    'declared_at' => $intent->cod_declared_at?->toISOString(),
                ] : null,
                'intent' => ['id' => $intent->id, 'status' => $intent->status->value, 'confirmed_at' => $intent->confirmed_at->toISOString(), 'expected_revision' => $intent->expected_revision],
            ];
        })->filter()->values();

        return response()->json(['data' => $data, 'meta' => [
            'current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total(),
        ]])->header('Cache-Control', 'private, no-store');
    }
}
