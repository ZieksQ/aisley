<?php

namespace App\Services\Logistics;

use App\Models\LinehaulDiscrepancy;
use App\Models\LinehaulReceipt;
use App\Models\LinehaulTrip;

class LinehaulReceivingProjection
{
    public function make(LinehaulTrip $trip): array
    {
        $receipts = LinehaulReceipt::where('linehaul_trip_id', $trip->id)->get()->keyBy('shipment_id');
        $discrepancies = LinehaulDiscrepancy::where('linehaul_trip_id', $trip->id)->orderBy('created_at')->get();
        $historical = $trip->received_at !== null && $trip->arrived_at === null;
        $items = $trip->shipments()->with('shipment.parcel.waybill')->orderBy('sequence')->get()->map(fn ($member): array => [
            'shipment_id' => $member->shipment_id,
            'reference' => $member->shipment->parcel->waybill->reference,
            'receipt' => $receipts->get($member->shipment_id)?->result,
        ]);

        return [
            'trip_id' => $trip->id, 'manifest_id' => $trip->linehaul_manifest_id,
            'status' => $trip->status->value, 'historical_receipt' => $historical,
            'from_hub' => $trip->fromHub?->name, 'to_hub' => $trip->toHub?->name,
            'arrived_at' => $trip->arrived_at?->toISOString(),
            'closed_at' => $trip->unloading_closed_at?->toISOString(), 'outcome' => $trip->unloading_outcome?->value,
            'counts' => ['expected' => $trip->parcel_count, 'received' => $historical ? $trip->parcel_count : $receipts->count(),
                'outstanding' => $historical ? 0 : $trip->parcel_count - $receipts->count(),
                'damaged' => $receipts->filter(fn ($receipt) => $receipt->condition->value === 'damaged')->count(),
                'open_discrepancies' => $discrepancies->whereNull('resolved_at')->count()],
            'items' => $items->all(), 'discrepancies' => $discrepancies->map(fn ($record): array => [
                'id' => $record->id, 'reference' => $record->reference, 'kind' => $record->kind->value,
                'reason' => $record->reason, 'resolved_at' => $record->resolved_at?->toISOString(), 'resolution_reason' => $record->resolution_reason,
            ])->all(),
        ];
    }
}
