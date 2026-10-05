<?php

namespace App\Services\Logistics;

use App\Enums\FulfillmentTaskLeg;
use App\Enums\FulfillmentTaskStatus;
use App\Enums\ShipmentEvidenceStatus;
use App\Models\LogisticsOrganization;
use App\Models\ShipmentEvidence;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class DeliveryConfirmationReadService
{
    public function list(LogisticsOrganization $organization, array $filters): LengthAwarePaginator
    {
        $history = ($filters['view'] ?? 'pending') === 'history';
        $query = ShipmentEvidence::query()->where('purpose', 'delivery_proof')->where('type', 'photo')
            ->whereHas('task', fn ($task) => $task->where('leg', FulfillmentTaskLeg::FinalMile->value)
                ->whereHas('shipment', fn ($shipment) => $shipment->where('current_logistics_organization_id', $organization->id)->where('current_hub_id', $organization->hub->id)))
            ->with(['task.shipment.parcel.order.address', 'task.shipment.parcel.waybill', 'task.courier.courierProfile', 'task.completionIntents', 'validatedBy.logisticsProfile']);
        if ($history) {
            $query->whereIn('status', [ShipmentEvidenceStatus::Validated->value, ShipmentEvidenceStatus::Rejected->value])->orderByDesc('validated_at');
        } else {
            $query->where('status', ShipmentEvidenceStatus::AwaitingValidation->value)
                ->whereHas('task', fn ($task) => $task->where('status', FulfillmentTaskStatus::OutForDelivery->value))
                ->whereHas('completionIntent', fn ($intent) => $intent->where('status', ShipmentEvidenceStatus::AwaitingValidation->value))
                ->orderBy('submitted_at');
        }
        if (! empty($filters['search'])) {
            $search = '%'.mb_strtolower(trim($filters['search'])).'%';
            $query->whereHas('task.shipment.parcel.order', fn ($order) => $order->whereRaw('LOWER(reference) LIKE ?', [$search]));
        }

        return $query->orderBy('id')->paginate((int) ($filters['per_page'] ?? 20));
    }
}
