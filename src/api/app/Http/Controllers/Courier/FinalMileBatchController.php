<?php

namespace App\Http\Controllers\Courier;

use App\Http\Controllers\Controller;
use App\Models\DispatchSchedule;
use App\Services\Courier\FinalMileBatchService;
use App\Services\Courier\FinalMileRouteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FinalMileBatchController extends Controller
{
    public function index(Request $request, FinalMileBatchService $service): JsonResponse
    {
        $affiliation = $request->user()->courierLogisticsAffiliation()->firstOrFail();
        $schedules = DispatchSchedule::query()->where('courier_id', $request->user()->id)
            ->where('logistics_organization_id', $affiliation->logistics_organization_id)
            ->where('logistics_hub_id', $affiliation->logistics_hub_id)
            ->with(['shipments.task', 'shipments.shipment.parcel.order'])
            ->orderByDesc('scheduled_for')->limit(30)->get();

        return response()->json(['data' => $schedules->filter(fn ($schedule) => $service->isCurrent($request->user(), $schedule))
            ->map(fn ($schedule) => $service->projection($request->user(), $schedule))->values()])
            ->header('Cache-Control', 'private, no-store');
    }

    public function show(Request $request, string $schedule, FinalMileBatchService $service): JsonResponse
    {
        return response()->json(['data' => $service->projection($request->user(), $service->schedule($request->user(), $schedule))])
            ->header('Cache-Control', 'private, no-store');
    }

    public function accept(Request $request, string $schedule, FinalMileBatchService $service): JsonResponse
    {
        return response()->json(['data' => $service->projection($request->user(), $service->accept($request->user(), $schedule))])
            ->header('Cache-Control', 'private, no-store');
    }

    public function route(Request $request, string $schedule, FinalMileRouteService $service): JsonResponse
    {
        return response()->json(['data' => $service->route($request->user(), $schedule)])
            ->header('Cache-Control', 'private, no-store');
    }
}
