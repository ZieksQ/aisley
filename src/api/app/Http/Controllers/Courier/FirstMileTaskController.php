<?php

namespace App\Http\Controllers\Courier;

use App\Enums\FirstMileTaskStatus;
use App\Enums\WaybillAccessAction;
use App\Enums\WaybillStatus;
use App\Http\Controllers\Controller;
use App\Models\FirstMileTask;
use App\Models\Waybill;
use App\Models\WaybillAccessEvent;
use App\Services\Waybills\CreateWaybill;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class FirstMileTaskController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate(['pickup_schedule_id' => ['sometimes', 'uuid'], 'per_page' => ['sometimes', 'integer', 'min:1', 'max:50']]);
        $tasks = FirstMileTask::query()->where('courier_id', $request->user()->id)
            ->when($data['pickup_schedule_id'] ?? null, fn ($query, $schedule) => $query->where('pickup_schedule_id', $schedule))
            ->whereIn('status', [FirstMileTaskStatus::Assigned, FirstMileTaskStatus::Accepted])
            ->with(['schedule', 'waybill:id,reference', 'order:id,reference,shop_id', 'order.address', 'order.shop:id,seller_id,name,contact_number', 'order.shop.seller.addresses'])
            ->orderBy('created_at')->orderBy('id')->paginate($data['per_page'] ?? 25);

        return response()->json(['data' => collect($tasks->items())->map(fn ($task) => $this->task($task)), 'meta' => ['current_page' => $tasks->currentPage(), 'last_page' => $tasks->lastPage(), 'total' => $tasks->total()]]);
    }

    public function accept(Request $request, string $task): JsonResponse
    {
        $record = DB::transaction(function () use ($request, $task) {
            $record = FirstMileTask::query()->where('courier_id', $request->user()->id)->whereKey($task)->lockForUpdate()->firstOrFail();
            if ($record->status === FirstMileTaskStatus::Assigned) {
                $record->update(['status' => FirstMileTaskStatus::Accepted, 'accepted_at' => now()]);
            }
            abort_unless($record->status === FirstMileTaskStatus::Accepted, 409, 'This task can no longer be accepted.');

            return $record->fresh(['schedule', 'waybill:id,reference', 'order:id,reference,shop_id', 'order.address', 'order.shop:id,seller_id,name,contact_number', 'order.shop.seller.addresses']);
        });

        return response()->json(['data' => $this->task($record)]);
    }

    public function resolveWaybill(Request $request, CreateWaybill $hasher): JsonResponse
    {
        $data = $request->validate(['payload' => ['required', 'string', 'max:128']]);
        $waybill = Waybill::query()->where('qr_token_hash', $hasher->hashQr($data['payload']))->where('status', WaybillStatus::Active)
            ->whereHas('firstMileTask', fn ($query) => $query->where('courier_id', $request->user()->id)->whereIn('status', [FirstMileTaskStatus::Assigned, FirstMileTaskStatus::Accepted]))
            ->with([
                'firstMileTask.schedule', 'firstMileTask.waybill:id,reference',
                'firstMileTask.order:id,reference,shop_id', 'firstMileTask.order.address',
                'firstMileTask.order.shop:id,seller_id,name,contact_number', 'firstMileTask.order.shop.seller.addresses',
                'order:id,reference',
            ])->firstOrFail();
        WaybillAccessEvent::create(['waybill_id' => $waybill->id, 'actor_id' => $request->user()->id, 'actor_role' => $request->user()->role, 'action' => WaybillAccessAction::Resolve, 'correlation_id' => Str::uuid(), 'occurred_at' => now()]);

        return response()->json(['data' => ['waybill_reference' => $waybill->reference, 'order_reference' => $waybill->order->reference, 'task' => $this->task($waybill->firstMileTask), 'matched' => true]]);
    }

    private function task(FirstMileTask $task): array
    {
        $pickup = $task->order?->shop?->seller?->addresses?->sortByDesc('is_default')->first();
        $destination = $task->order?->address;

        return [
            'id' => $task->id,
            'status' => $task->status instanceof \BackedEnum ? $task->status->value : $task->status,
            'order' => ['id' => $task->order_id, 'reference' => $task->order?->reference],
            'waybill' => ['reference' => $task->waybill?->reference],
            'pickup' => $pickup ? [
                'shop_name' => $task->order->shop->name,
                'contact_number' => $task->order->shop->contact_number ?? $pickup->contact_number,
                'address_line_1' => $pickup->address_line_1,
                'address_line_2' => $pickup->address_line_2,
                'barangay' => $pickup->barangay,
                'city_municipality' => $pickup->city_municipality,
                'province' => $pickup->province,
                'region' => $pickup->region,
                'postal_code' => $pickup->postal_code,
                'latitude' => $pickup->latitude,
                'longitude' => $pickup->longitude,
            ] : null,
            'destination_area' => $destination ? ['city_municipality' => $destination->city_municipality, 'province' => $destination->province, 'region' => $destination->region] : null,
            'schedule' => ['id' => $task->schedule->id, 'reference' => $task->schedule->reference, 'starts_at' => $task->schedule->starts_at->toISOString(), 'ends_at' => $task->schedule->ends_at->toISOString(), 'timezone' => 'UTC'],
        ];
    }
}
