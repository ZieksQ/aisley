<?php

namespace App\Http\Controllers\Logistics;

use App\Enums\CourierAffiliationStatus;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\CancelPickupScheduleRequest;
use App\Http\Requests\Logistics\CreatePickupScheduleRequest;
use App\Http\Requests\Logistics\ListPickupsRequest;
use App\Http\Requests\Logistics\RevisePickupScheduleRequest;
use App\Models\CourierLogisticsAffiliation;
use App\Models\PickupSchedule;
use App\Models\SellerPickupRequest;
use App\Models\Waybill;
use App\Services\Logistics\PickupScheduleService;
use App\Services\Waybills\WaybillPdfService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PickupController extends Controller
{
    public function index(ListPickupsRequest $request): JsonResponse
    {
        $org = $request->user()->logisticsOrganization()->with('hub')->firstOrFail();
        $data = $request->validated();
        $paginator = SellerPickupRequest::query()->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id)
            ->when($data['status'] ?? null, fn ($q, $value) => $q->where('status', $value))
            ->when($data['date_from'] ?? null, fn ($q, $value) => $q->whereDate('created_at', '>=', $value))
            ->when($data['date_to'] ?? null, fn ($q, $value) => $q->whereDate('created_at', '<=', $value))
            ->when($data['search'] ?? null, fn ($q, $value) => $q->where(function ($search) use ($value) {
                if (Str::isUuid($value)) {
                    $search->where('id', $value);
                }
                $method = Str::isUuid($value) ? 'orWhereHas' : 'whereHas';
                $search->{$method}('waybills', fn ($waybills) => $waybills->where('reference', 'like', '%'.addcslashes($value, '%_').'%'))
                    ->orWhereHas('orders.order', fn ($orders) => $orders->where('reference', 'like', '%'.addcslashes($value, '%_').'%'));
            }))
            ->with(['waybills:id,seller_pickup_request_id,reference,created_at', 'orders.order:id,reference,status', 'orders.order.waybill.snapshot', 'orders.order.firstMileTask.schedule:id,reference,courier_id,status,starts_at,ends_at', 'shop:id,name'])
            ->withCount('orders')->orderByDesc('created_at')->orderByDesc('id')->paginate($data['per_page'] ?? 25);

        $includeOrders = (bool) ($data['include_orders'] ?? false);

        return response()->json(['data' => collect($paginator->items())->map(fn ($pickup) => $this->pickup($pickup, $includeOrders)), 'meta' => ['current_page' => $paginator->currentPage(), 'last_page' => $paginator->lastPage(), 'per_page' => $paginator->perPage(), 'total' => $paginator->total()]]);
    }

    public function show(Request $request, string $pickup): JsonResponse
    {
        $org = $request->user()->logisticsOrganization()->with('hub')->firstOrFail();
        $record = SellerPickupRequest::query()->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id)->whereKey($pickup)
            ->with(['shop:id,name,seller_id', 'orders.order:id,reference,status', 'orders.order.waybill.snapshot', 'orders.order.firstMileTask.schedule', 'orders.order.firstMileTask.courier.courierProfile'])->withCount('orders')->firstOrFail();

        return response()->json(['data' => $this->pickup($record, true)]);
    }

    public function createSchedule(CreatePickupScheduleRequest $request, PickupScheduleService $service): JsonResponse
    {
        return response()->json(['data' => $this->schedule($service->create($request->user(), $request->validated(), $request->idempotencyKey()))], 201);
    }

    public function reviseSchedule(RevisePickupScheduleRequest $request, string $schedule, PickupScheduleService $service): JsonResponse
    {
        return response()->json(['data' => $this->schedule($service->revise($request->user(), $schedule, $request->validated()))]);
    }

    public function cancelSchedule(CancelPickupScheduleRequest $request, string $schedule, PickupScheduleService $service): JsonResponse
    {
        return response()->json(['data' => $this->schedule($service->cancel($request->user(), $schedule, $request->validated()))]);
    }

    public function waybills(Request $request, string $pickup): JsonResponse
    {
        $org = $request->user()->logisticsOrganization()->with('hub')->firstOrFail();
        $record = SellerPickupRequest::query()->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id)->whereKey($pickup)->firstOrFail();

        return response()->json(['data' => $record->waybills()->orderBy('created_at')->orderBy('id')->get()->map(fn (Waybill $waybill) => ['id' => $waybill->id, 'order_id' => $waybill->order_id, 'reference' => $waybill->reference, 'created_at' => $waybill->created_at->toISOString(), 'printable' => true, 'pdf_url' => "/api/v1/logistics/waybills/{$waybill->id}.pdf"])]);
    }

    public function couriers(Request $request): JsonResponse
    {
        $org = $request->user()->logisticsOrganization()->with('hub')->firstOrFail();
        $couriers = CourierLogisticsAffiliation::query()
            ->where('logistics_organization_id', $org->id)
            ->where('logistics_hub_id', $org->hub->id)
            ->where('status', CourierAffiliationStatus::Approved)
            ->whereHas('courier', fn ($query) => $query->where('status', UserStatus::Active))
            ->with('courier.courierProfile')
            ->orderBy('created_at')
            ->get()
            ->map(fn ($affiliation) => [
                'id' => $affiliation->courier_id,
                'name' => trim(($affiliation->courier->courierProfile?->first_name ?? '').' '.($affiliation->courier->courierProfile?->last_name ?? '')),
                'email' => $affiliation->courier->email,
            ]);

        return response()->json(['data' => $couriers]);
    }

    public function waybillPdf(Request $request, string $waybill, WaybillPdfService $pdf)
    {
        $org = $request->user()->logisticsOrganization()->with('hub')->firstOrFail();
        $record = Waybill::query()->where('logistics_organization_id', $org->id)->where('logistics_hub_id', $org->hub->id)->whereKey($waybill)->with('snapshot')->firstOrFail();

        $disposition = $request->query('disposition') === 'inline' ? 'inline' : 'attachment';

        return $pdf->response(collect([$record]), $request->user(), $disposition === 'inline' ? 'view' : 'download', $disposition);
    }

    private function pickup(SellerPickupRequest $pickup, bool $detail = false): array
    {
        $orders = $pickup->orders->map(function ($link): array {
            $address = $link->order?->waybill?->snapshot?->payload['pickup'] ?? null;

            return ['id' => $link->order_id, 'reference' => $link->order?->reference, 'status' => $link->order?->status?->value, 'pickup_area' => $address ? ['city_municipality' => $address['city_municipality'], 'province' => $address['province'], 'region' => $address['region']] : null, 'scheduled' => $link->order?->firstMileTask !== null, 'schedule' => $link->order?->firstMileTask?->schedule ? $this->schedule($link->order->firstMileTask->schedule) : null, 'waybill' => $link->order?->waybill ? ['id' => $link->order->waybill->id, 'reference' => $link->order->waybill->reference] : null];
        });
        $pickupAreas = $orders->pluck('pickup_area')->filter()->unique(fn ($area) => implode('|', $area))->values();
        $base = ['id' => $pickup->id, 'status' => $pickup->status, 'shop' => ['id' => $pickup->shop_id, 'name' => $pickup->shop?->name, 'pickup_area' => $pickupAreas->first(), 'pickup_areas' => $pickupAreas], 'order_count' => $pickup->orders_count ?? $orders->count(), 'unscheduled_count' => $orders->where('scheduled', false)->count(), 'ready_at' => $pickup->created_at->toISOString(), 'created_at' => $pickup->created_at->toISOString()];

        return $detail ? [...$base, 'orders' => $orders->values()] : [...$base, 'schedules' => $orders->pluck('schedule')->filter()->unique('id')->values()];
    }

    private function schedule(PickupSchedule $schedule): array
    {
        return ['id' => $schedule->id, 'reference' => $schedule->reference, 'status' => $schedule->status instanceof \BackedEnum ? $schedule->status->value : $schedule->status, 'courier_id' => $schedule->courier_id, 'starts_at' => $schedule->starts_at->toISOString(), 'ends_at' => $schedule->ends_at->toISOString(), 'timezone' => 'UTC', 'revision' => $schedule->revision, 'order_ids' => $schedule->relationLoaded('orders') ? $schedule->orders->pluck('order_id')->values() : null];
    }
}
