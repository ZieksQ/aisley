<?php

namespace App\Services\Logistics;

use App\Exceptions\Fulfillment\FulfillmentException;
use App\Models\CompanyTruck;
use App\Models\DeliveryTask;
use App\Models\DispatchScheduleShipment;
use App\Models\FirstMileTask;
use App\Models\LinehaulTrip;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class FleetAssignmentService
{
    public function listing(User $actor, array $input): LengthAwarePaginator
    {
        $org = $actor->logisticsOrganization()->with('hub')->first();
        if ($org?->hub === null) {
            throw FulfillmentException::notFound('LOGISTICS_CONTEXT_NOT_FOUND', 'The Logistics organization or operational hub is unavailable.');
        }

        $first = FirstMileTask::query()
            ->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id)
            ->whereNotNull('courier_id')->whereIn('status', ['assigned', 'accepted', 'picked_up_from_seller'])
            ->whereHas('schedule', fn ($q) => $q->where('status', '!=', 'cancelled'))
            ->whereHas('order', fn ($q) => $q->whereNotIn('status', ['cancelled', 'rejected', 'delivered', 'returned']))
            ->where(function ($q): void {
                $q->whereIn('status', ['assigned', 'accepted'])
                    ->orWhereHas('order.parcel.shipment', fn ($q) => $q->where('status', 'picked_up_from_seller')->whereNull('received_at_hub_at'));
            });
        $last = DeliveryTask::query()->where('leg', 'final_mile')->whereNotNull('courier_id')
            ->whereIn('status', ['delivery_assigned', 'delivery_accepted', 'picked_up_from_hub', 'in_transit', 'out_for_delivery'])
            ->whereHas('shipment', fn ($q) => $q->where('current_logistics_organization_id', $org->id)
                ->where('current_hub_id', $org->hub->id)->whereIn('status', [
                    'dispatched_from_hub', 'delivery_assigned', 'delivery_accepted', 'picked_up_from_hub', 'in_transit', 'out_for_delivery',
                ]))
            ->whereHas('shipment.parcel.order', fn ($q) => $q->whereNotIn('status', ['cancelled', 'rejected', 'delivered', 'returned']));
        $linehaul = LinehaulTrip::query()->where('owner_logistics_organization_id', $org->id)
            ->whereIn('status', ['pending_acceptance', 'scheduled', 'in_transfer', 'receiving']);

        $idleTrucks = CompanyTruck::query()->where('logistics_organization_id', $org->id)
            ->whereDoesntHave('trips', fn ($q) => $q->whereIn('status', ['pending_acceptance', 'scheduled', 'in_transfer', 'receiving']));

        $sources = [
            'first_mile' => [$first, 'courier', 'waybill'],
            'linehaul' => [$linehaul, 'driver', 'truck'],
            'linehaul_truck' => [$idleTrucks, '', ''],
            'final_mile' => [$last, 'courier', 'shipment.parcel'],
        ];
        $union = null;
        foreach ($sources as $stage => [$query, $courier, $reference]) {
            if (! empty($input['stage']) && $input['stage'] !== ($stage === 'linehaul_truck' ? 'linehaul' : $stage)) {
                continue;
            }
            $this->search($query, trim($input['search'] ?? ''), $courier, $reference, $stage);
            $part = (clone $query)->select(['id', 'created_at'])->selectRaw('? AS stage', [$stage])->toBase();
            $union = $union === null ? $part : $union->unionAll($part);
        }

        // Paginate the union in SQL; hydrate only models on this page, never an entire tenant's work.
        $page = DB::query()->fromSub($union, 'assignments')->orderByDesc('created_at')->orderBy('stage')->orderBy('id')
            ->paginate($input['per_page'] ?? 20);
        $models = [];
        $relations = [
            'first_mile' => ['courier.courierProfile', 'schedule.hub.address', 'waybill.snapshot'],
            'linehaul' => ['driver.courierProfile', 'truck.lastConfirmedHub.address', 'fromHub.address', 'fromHub.organization:id,business_name', 'toHub.address', 'toHub.organization:id,business_name'],
            'linehaul_truck' => ['lastConfirmedHub.address'],
            'final_mile' => ['courier.courierProfile', 'shipment.currentHub.address', 'shipment.parcel.order.address'],
        ];
        foreach ($sources as $stage => [$query]) {
            $ids = $page->getCollection()->where('stage', $stage)->pluck('id');
            $models[$stage] = $ids->isEmpty() ? collect() : $query->whereKey($ids)->with($relations[$stage])->get()->keyBy('id');
        }
        if ($models['final_mile']->isNotEmpty()) {
            $members = DispatchScheduleShipment::query()->whereIn('delivery_task_id', $models['final_mile']->keys())
                ->whereHas('schedule', fn ($q) => $q->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id))
                ->with('schedule')->orderByDesc('created_at')->orderByDesc('id')->get();
            foreach ($models['final_mile'] as $task) {
                $member = $members->first(fn ($member) => $member->delivery_task_id === $task->id && $member->schedule?->courier_id === $task->courier_id);
                $task->setRelation('monitoringSchedule', $member?->schedule);
            }
        }
        $projection = new FleetAssignmentProjection;
        $page->setCollection($page->getCollection()->map(fn ($row) => isset($models[$row->stage][$row->id])
            ? $projection->resolve($row->stage, $models[$row->stage][$row->id]) : null)->filter()->values());

        return $page;
    }

    private function search(Builder $query, string $term, string $courier, string $reference, string $stage): void
    {
        if ($term === '') {
            return;
        }
        $like = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower($term)).'%';
        if ($stage === 'linehaul_truck') {
            $query->whereRaw("LOWER(plate_number) LIKE ? ESCAPE '!'", [$like]);

            return;
        }
        $query->where(function ($q) use ($like, $courier, $reference, $stage): void {
            $q->whereHas($courier.'.courierProfile', fn ($q) => $q->whereRaw("LOWER(first_name || ' ' || last_name) LIKE ? ESCAPE '!'", [$like]))
                ->orWhereHas($reference, fn ($q) => $q->whereRaw('LOWER('.($stage === 'linehaul' ? 'plate_number' : 'reference').") LIKE ? ESCAPE '!'", [$like]));
        });
    }
}
