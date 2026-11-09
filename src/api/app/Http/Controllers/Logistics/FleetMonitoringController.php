<?php

namespace App\Http\Controllers\Logistics;

use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\FleetMonitoringRequest;
use App\Http\Resources\Logistics\FleetMonitoringTripResource;
use App\Http\Resources\Logistics\FleetMonitoringTruckResource;
use App\Services\Logistics\FleetMonitoringService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;

class FleetMonitoringController extends Controller
{
    public function index(FleetMonitoringRequest $request, FleetMonitoringService $service): JsonResponse
    {
        $request->attributes->set('fleet_monitoring_time', now());
        [$page, $summary] = $service->listing($request->user(), $request->validated(), $request->attributes->get('fleet_monitoring_time'));

        return $this->response(FleetMonitoringTruckResource::collection($page->items())->resolve($request), $request,
            [...$this->pagination($page), 'summary' => $summary]);
    }

    public function show(FleetMonitoringRequest $request, string $truck, FleetMonitoringService $service): JsonResponse
    {
        $request->attributes->set('fleet_monitoring_time', now());

        return $this->response((new FleetMonitoringTruckResource($service->truck($request->user(), $truck)))->resolve($request), $request);
    }

    public function trips(FleetMonitoringRequest $request, string $truck, FleetMonitoringService $service): JsonResponse
    {
        $request->attributes->set('fleet_monitoring_time', now());
        $page = $service->history($request->user(), $truck, $request->validated());

        return $this->response(FleetMonitoringTripResource::collection($page->items())->resolve($request), $request, $this->pagination($page));
    }

    public function trip(FleetMonitoringRequest $request, string $truck, string $trip, FleetMonitoringService $service): JsonResponse
    {
        $request->attributes->set('fleet_monitoring_time', now());

        return $this->response((new FleetMonitoringTripResource($service->trip($request->user(), $truck, $trip)))->resolve($request), $request);
    }

    private function pagination(LengthAwarePaginator $page): array
    {
        return ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()];
    }

    private function response(array $data, FleetMonitoringRequest $request, array $meta = []): JsonResponse
    {
        return response()->json(['data' => $data, 'meta' => [...$meta, 'server_time' => $request->attributes->get('fleet_monitoring_time')->toISOString()]])
            ->header('Cache-Control', 'private, no-store');
    }
}
