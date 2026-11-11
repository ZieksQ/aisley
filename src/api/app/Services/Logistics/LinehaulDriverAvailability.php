<?php

namespace App\Services\Logistics;

use App\Models\DeliveryTask;
use App\Models\DispatchSchedule;
use App\Models\DispatchScheduleShipment;
use App\Models\LinehaulTrip;
use App\Models\PickupSchedule;
use Illuminate\Support\Collection;

class LinehaulDriverAvailability
{
    public static function workQueries(array $driverIds): array
    {
        return [
            'linehaul' => LinehaulTrip::query()->whereIn('driver_id', $driverIds)->whereIn('status', ['pending_acceptance', 'scheduled', 'in_transfer', 'receiving']),
            'pickup' => PickupCourierWork::query()->whereIn('courier_id', $driverIds),
            'pickup_schedule' => PickupSchedule::query()->whereIn('courier_id', $driverIds)->where('status', 'scheduled'),
            'delivery_schedule' => DispatchSchedule::query()->whereIn('courier_id', $driverIds)->where('status', 'scheduled'),
            'delivery' => DeliveryTask::query()->whereIn('courier_id', $driverIds)->whereIn('status', ['offered', 'delivery_assigned', 'accepted', 'delivery_accepted', 'picked_up_from_hub', 'in_transit', 'out_for_delivery']),
        ];
    }

    public function enrich(Collection $drivers, string $orgId, string $hubId): Collection
    {
        if ($drivers->isEmpty()) {
            return $drivers;
        }
        $queries = self::workQueries($drivers->pluck('id')->all());
        $work = [];
        $add = function (string $driverId, string $key, array $summary) use (&$work): void {
            $work[$driverId][$key] = $summary;
        };
        foreach ($queries['linehaul']->with(['fromHub:id,name', 'toHub:id,name', 'truck:id,plate_number'])->get() as $trip) {
            $local = $trip->owner_logistics_organization_id === $orgId;
            $location = match ($trip->status->value) {
                'receiving' => 'Receiving at '.($trip->toHub?->name ?? 'destination hub'),
                'in_transfer' => $trip->courier_arrived_at
                    ? 'Driver reported arrival at '.($trip->toHub?->name ?? 'destination hub').' (not yet confirmed by Logistics)'
                    : 'In transit: '.($trip->fromHub?->name ?? 'origin hub').' → '.($trip->toHub?->name ?? 'destination hub').'; exact location unavailable',
                default => 'Awaiting departure; planned origin: '.($trip->fromHub?->name ?? 'unknown hub'),
            };
            $add($trip->driver_id, 'linehaul:'.$trip->id, $local ? [
                'type' => 'linehaul', 'reference' => $trip->truck?->plate_number ?? $trip->id, 'status' => $trip->status->value,
                'scheduled_for' => $trip->scheduled_for?->toISOString(),
                'route' => ($trip->fromHub?->name ?? 'Origin hub').' → '.($trip->toHub?->name ?? 'Destination hub'),
                'location' => $location,
            ] : $this->privateWork());
        }
        $pickups = $queries['pickup']->with(['schedule', 'waybill.snapshot'])->get();
        $schedules = $queries['pickup_schedule']->get()->keyBy('id');
        foreach ($pickups as $task) {
            if ($task->schedule && $task->schedule->courier_id === $task->courier_id) {
                $schedules->put($task->schedule->id, $task->schedule);
            } else {
                $add($task->courier_id, 'pickup:'.$task->id, $task->logistics_organization_id === $orgId && $task->logistics_hub_id === $hubId ? [
                    'type' => 'pickup', 'reference' => null, 'status' => $task->status->value,
                    'scheduled_for' => null, 'route' => null, 'location' => 'Pickup work outstanding; exact location unavailable',
                ] : $this->privateWork());
            }
        }
        foreach ($schedules as $schedule) {
            $local = $schedule->logistics_organization_id === $orgId && $schedule->logistics_hub_id === $hubId;
            $tasks = $pickups->where('pickup_schedule_id', $schedule->id)->where('courier_id', $schedule->courier_id);
            $stages = $tasks->pluck('status')->map(fn ($status) => $status->value)->unique()->implode(', ');
            $collected = $tasks->contains(fn ($task) => $task->status->value === 'picked_up_from_seller');
            $add($schedule->courier_id, 'pickup_schedule:'.$schedule->id, $local ? [
                'type' => 'pickup', 'reference' => $schedule->reference, 'status' => $collected ? 'awaiting_hub_receipt' : ($stages ?: $schedule->status->value),
                'scheduled_for' => $schedule->starts_at?->toISOString(),
                'route' => $tasks->map(fn ($task) => $this->area($task->waybill?->snapshot?->payload['pickup'] ?? []))->filter()->unique()->implode(' / ') ?: null,
                'location' => $collected ? 'Collected parcels awaiting hub receipt; exact location unavailable' : 'Pickup run planned; exact location unavailable',
            ] : $this->privateWork());
        }
        $deliveries = $queries['delivery']->with('shipment.parcel.order.address')->get();
        $dispatches = $queries['delivery_schedule']->get()->keyBy('id');
        $members = DispatchScheduleShipment::query()->whereIn('delivery_task_id', $deliveries->pluck('id'))
            ->with('schedule')->orderByDesc('created_at')->orderByDesc('id')->get();
        foreach ($deliveries as $task) {
            $member = $members->first(fn ($member) => $member->delivery_task_id === $task->id && $member->schedule?->courier_id === $task->courier_id);
            if ($member?->schedule) {
                $dispatches->put($member->schedule->id, $member->schedule);
            } else {
                $local = $task->shipment?->current_logistics_organization_id === $orgId && $task->shipment?->current_hub_id === $hubId;
                $add($task->courier_id, 'delivery:'.$task->id, $local ? [
                    'type' => 'delivery', 'reference' => null, 'status' => $task->getRawOriginal('status'),
                    'scheduled_for' => null, 'route' => null, 'location' => 'Delivery work outstanding; exact location unavailable',
                ] : $this->privateWork());
            }
        }
        foreach ($dispatches as $schedule) {
            $local = $schedule->logistics_organization_id === $orgId && $schedule->logistics_hub_id === $hubId;
            $taskIds = $members->where('dispatch_schedule_id', $schedule->id)->pluck('delivery_task_id');
            $stages = $deliveries->where('courier_id', $schedule->courier_id)->whereIn('id', $taskIds)->map(fn ($task) => $task->getRawOriginal('status'))->unique()->values();
            $add($schedule->courier_id, 'delivery_schedule:'.$schedule->id, $local ? [
                'type' => 'delivery', 'reference' => $schedule->reference, 'status' => $stages->isEmpty() ? $schedule->status->value : $stages->implode(', '),
                'scheduled_for' => $schedule->scheduled_for?->toISOString(),
                'route' => $deliveries->where('courier_id', $schedule->courier_id)->whereIn('id', $taskIds)->map(fn ($task) => $this->area($task->shipment?->parcel?->order?->address?->toArray() ?? []))->filter()->unique()->implode(' / ') ?: null,
                'location' => 'Delivery run; exact location unavailable',
            ] : $this->privateWork());
        }

        // Historical receipt is evidence of a past location, never a current GPS position.
        $lastReceipts = LinehaulTrip::query()->whereIn('driver_id', $drivers->pluck('id'))
            ->where('owner_logistics_organization_id', $orgId)->whereNotNull('received_at')
            ->where('id', function ($query): void {
                $query->select('history.id')->from('linehaul_trips as history')
                    ->whereColumn('history.driver_id', 'linehaul_trips.driver_id')->whereNotNull('history.received_at')
                    ->orderByDesc('history.received_at')->orderByDesc('history.id')->limit(1);
            })->with('toHub:id,name')->get()->keyBy('driver_id');

        return $drivers->map(function (array $driver) use ($work, $lastReceipts): array {
            $assignments = array_values($work[$driver['id']] ?? []);

            $receipt = $lastReceipts->get($driver['id']);
            $lastLocation = $receipt?->toHub?->name
                ? 'Last confirmed hub: '.$receipt->toHub->name.' · '.$receipt->received_at->copy()->timezone('Asia/Manila')->format('M j, Y g:i A').' PHT (trip receipt)'
                : null;

            return [...$driver, 'available' => $assignments === [], 'work' => $assignments,
                'operational_location' => collect($assignments)->pluck('location')->filter()->unique()->implode(' · ') ?: ($assignments === [] ? $lastLocation : null)];
        })->sort(fn ($a, $b) => ($b['available'] <=> $a['available']) ?: strcasecmp($a['name'], $b['name']) ?: strcmp($a['id'], $b['id']))->values();
    }

    private function area(mixed $address): string
    {
        if (! is_array($address)) {
            return '';
        }

        return implode(', ', array_filter([$address['barangay'] ?? null, $address['city_municipality'] ?? null, $address['province'] ?? null]));
    }

    private function privateWork(): array
    {
        return ['type' => 'other', 'reference' => null, 'status' => 'busy', 'scheduled_for' => null, 'route' => null, 'location' => null];
    }
}
