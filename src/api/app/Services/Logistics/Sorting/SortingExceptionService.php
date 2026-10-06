<?php

namespace App\Services\Logistics\Sorting;

use App\Enums\Logistics\SortingExceptionCode;
use App\Enums\ShipmentStatus;
use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\Shipment;
use App\Models\SortingException;
use App\Models\SortingScan;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class SortingExceptionService
{
    public function outstanding(Shipment $shipment): ?SortingException
    {
        return SortingException::query()->where('open_key', $shipment->id.':'.$shipment->current_hub_id)->lockForUpdate()->first();
    }

    public function record(Shipment $shipment, SortingScan $scan, string $cause): SortingException
    {
        $exception = $this->outstanding($shipment);
        $data = ['sorting_lane_id' => $scan->sorting_lane_id, 'exception_code' => $scan->exception_code,
            'cause' => $cause, 'reason' => $scan->reason, 'last_attempt_at' => now(),
            'attempts' => ($exception?->attempts ?? 0) + 1, 'revision' => ($exception?->revision ?? 0) + 1];
        // Damage remains authoritative even if a later attempt has a routing cause.
        if ($exception?->exception_code === SortingExceptionCode::Damaged && $exception->released_at === null) {
            $data['exception_code'] = SortingExceptionCode::Damaged;
        }
        if ($exception) {
            $exception->update($data);
        } else {
            $exception = SortingException::create([...$data, 'shipment_id' => $shipment->id,
                'logistics_organization_id' => $shipment->current_logistics_organization_id, 'logistics_hub_id' => $shipment->current_hub_id,
                'open_key' => $shipment->id.':'.$shipment->current_hub_id, 'recorded_by' => $scan->recorded_by_logistics_id, 'recorded_at' => now()]);
        }
        if ($scan->exception_code === SortingExceptionCode::Damaged) {
            $exception->update(['inspection_reason' => null, 'released_by' => null, 'released_at' => null]);
        }

        return $exception;
    }

    public function resolve(Shipment $shipment, SortingScan $scan): void
    {
        $exception = $this->outstanding($shipment);
        if ($exception) {
            $exception->update(['open_key' => null, 'resolved_at' => now(), 'resolved_by' => $scan->recorded_by_logistics_id,
                'resolution_scan_id' => $scan->id, 'revision' => $exception->revision + 1]);
        }
    }

    public function queue(User $actor, int $page): array
    {
        $org = $actor->logisticsOrganization()->with('hub')->firstOrFail();
        $rows = SortingException::query()->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id)
            ->whereNull('resolved_at')->orderBy('recorded_at')->orderBy('id')->paginate(10, ['*'], 'page', $page);

        return ['data' => $rows->getCollection()->map(function ($row): array {
            $shipment = Shipment::with('parcel.waybill')->find($row->shipment_id);
            $action = $shipment?->condition_hold ? 'Complete inspection and release the receiving condition hold first' : ($row->exception_code === SortingExceptionCode::Damaged && ! $row->released_at ? 'Complete documented inspection and release' : match ($row->cause) {
                'no_active_plan' => 'Publish or activate a version, then rescan',
                'mapped_lane_unavailable', 'hub_lane_unavailable', 'lane_blocked' => 'Resume or correct the mapped lane, then rescan',
                'connection_unavailable' => 'Restore the committed connection, then rescan',
                default => 'Correct the mapping or routing input, then rescan',
            });

            return [...$row->toArray(), 'reference' => $shipment?->parcel?->waybill?->reference,
                'shipment_revision' => $shipment?->revision, 'condition_hold' => $shipment?->condition_hold,
                'next_action' => $action, 'can_recover' => ! $shipment?->condition_hold && ($row->exception_code !== SortingExceptionCode::Damaged || $row->released_at !== null)];
        })->all(), 'current_page' => $rows->currentPage(), 'last_page' => $rows->lastPage(), 'total' => $rows->total()];
    }

    public function release(User $actor, string $id, array $input, string $key): array
    {
        $org = $actor->logisticsOrganization()->with('hub')->firstOrFail();

        return DB::transaction(function () use ($actor, $org, $id, $input, $key): array {
            SortingLocks::hub($org->hub->id);

            return app(SortingMutationService::class)->run($actor, $key, ['exception_id' => $id, ...$input], function () use ($actor, $org, $id, $input): array {
                $row = SortingException::query()->whereKey($id)->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id)->lockForUpdate()->first()
                    ?? throw FulfillmentException::notFound('SORT_EXCEPTION_NOT_FOUND', 'This sorting exception is unavailable.');
                if ($row->revision !== (int) $input['expected_revision'] || $row->resolved_at !== null) {
                    throw FulfillmentException::conflict('SORT_EXCEPTION_CHANGED', 'Refresh this exception before inspection.');
                }
                $shipment = Shipment::whereKey($row->shipment_id)->lockForUpdate()->firstOrFail();
                if ($shipment->condition_hold) {
                    throw FulfillmentException::conflict('SHIPMENT_CONDITION_HOLD', 'Release the authoritative receiving condition hold before releasing this sorting exception.');
                }
                if ($shipment->status !== ShipmentStatus::ReceivedAtHub || $shipment->current_hub_id !== $org->hub->id) {
                    throw FulfillmentException::conflict('SORT_EXCEPTION_CUSTODY_CHANGED', 'This parcel is no longer received at this hub.');
                }
                $row->update(['inspection_reason' => trim($input['reason']), 'released_by' => $actor->id, 'released_at' => now(), 'revision' => $row->revision + 1]);

                return $row->fresh()->toArray();
            });
        }, 3);
    }
}
