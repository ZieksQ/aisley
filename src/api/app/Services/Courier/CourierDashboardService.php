<?php

namespace App\Services\Courier;

use App\Enums\FirstMileTaskStatus;
use App\Enums\FulfillmentTaskLeg;
use App\Enums\FulfillmentTaskStatus;
use App\Models\DeliveryTask;
use App\Models\FirstMileTask;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;

class CourierDashboardService
{
    public function __construct(private CourierNotificationService $notifications) {}

    public function snapshot(User $courier): array
    {
        $scope = $this->notifications->scope($courier);
        abort_unless($scope !== null, 403, 'This Courier affiliation is unavailable.');
        $generatedAt = now()->utc()->toISOString();
        $sections = [];
        foreach (['notifications', 'available_tasks', 'active_tasks'] as $name) {
            try {
                if ($name === 'notifications') {
                    $page = $this->notifications->list($courier, 'all', 5, null);
                    $rows = $page['data'];
                    $hasMore = $page['meta']['next_cursor'] !== null;
                } else {
                    $rows = $this->tasks($courier, $scope, $name === 'available_tasks');
                    $hasMore = count($rows) > 5;
                    $rows = array_slice($rows, 0, 5);
                }
                $sections[$name] = [
                    'state' => $rows === [] ? 'empty' : 'available',
                    'reason' => null, 'data' => $rows, 'has_more' => $hasMore,
                    'generated_at' => $generatedAt,
                ];
            } catch (QueryException $error) {
                // Independent read queries permit partial results even on PostgreSQL.
                // Do not expose SQL, bindings or private projection details.
                $sections[$name] = [
                    'state' => 'failed', 'reason' => 'SECTION_UNAVAILABLE',
                    'data' => [], 'has_more' => false, 'generated_at' => null,
                ];
            }
        }

        return [
            'data' => [],
            'meta' => ['version' => 2, 'next_cursor' => null, 'generated_at' => $generatedAt],
            'sections' => $sections,
            'freshness' => [
                'state' => collect($sections)->contains('state', 'failed') ? 'partial' : 'fresh',
                'reason' => null, 'generated_at' => $generatedAt,
            ],
        ];
    }

    private function tasks(User $courier, array $scope, bool $available): array
    {
        $first = FirstMileTask::query()->where('courier_id', $courier->id)
            ->where('logistics_organization_id', $scope['organization_id'])
            ->where('logistics_hub_id', $scope['hub_id'])
            ->where('status', $available ? FirstMileTaskStatus::Assigned : FirstMileTaskStatus::Accepted)
            ->with(['order:id,reference', 'waybill:id,reference'])
            ->orderBy('created_at')->orderBy('id')->limit(6)->get();
        $final = DeliveryTask::query()->where('courier_id', $courier->id)
            ->where('leg', FulfillmentTaskLeg::FinalMile)
            ->whereHas('shipment', fn (Builder $query) => $query
                ->where('current_logistics_organization_id', $scope['organization_id'])
                ->where('current_hub_id', $scope['hub_id']))
            ->whereIn('status', $available ? [FulfillmentTaskStatus::DeliveryAssigned] : [
                FulfillmentTaskStatus::DeliveryAccepted, FulfillmentTaskStatus::PickedUpFromHub,
                FulfillmentTaskStatus::InTransit, FulfillmentTaskStatus::OutForDelivery,
            ])
            ->with(['shipment.parcel.order:id,reference', 'shipment.parcel.waybill:id,reference'])
            ->orderBy('created_at')->orderBy('id')->limit(6)->get();
        $rows = [];
        foreach ($first as $task) {
            $rows[] = $this->row($task, 'first_mile', $task->order?->reference,
                $task->waybill?->reference, $task->pickup_schedule_id, null);
        }
        foreach ($final as $task) {
            $rows[] = $this->row($task, 'final_mile', $task->shipment?->parcel?->order?->reference,
                $task->shipment?->parcel?->waybill?->reference, null, $task->revision);
        }
        usort($rows, fn (array $a, array $b) => [$a['created_at'], $a['leg'], $a['id']]
            <=> [$b['created_at'], $b['leg'], $b['id']]);

        return array_slice($rows, 0, 6);
    }

    private function row(FirstMileTask|DeliveryTask $task, string $leg, ?string $order,
        ?string $waybill, ?string $schedule, ?int $revision): array
    {
        return [
            'id' => $task->id, 'leg' => $leg, 'status' => $task->status->value,
            'revision' => $revision, 'order_reference' => $order,
            'waybill_reference' => $waybill, 'schedule_id' => $schedule,
            'created_at' => $task->created_at->utc()->toISOString(),
        ];
    }
}
