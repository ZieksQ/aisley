<?php

namespace App\Http\Controllers\Logistics;

use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\AddSortingPlanLaneRequest;
use App\Http\Requests\Logistics\CreateSortingPlanRequest;
use App\Http\Requests\Logistics\RemoveSortingPlanLaneRequest;
use App\Http\Requests\Logistics\SortingVersionActionRequest;
use App\Http\Requests\Logistics\UpdateSortingPlanRequest;
use App\Models\SortingPlan;
use App\Models\SortingPlanLane;
use App\Services\Logistics\Sorting\SortingVersionService;
use App\Services\Logistics\SortingPlanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SortingPlanController extends Controller
{
    public function versionAction(SortingVersionActionRequest $request, SortingPlan $plan, string $action, SortingVersionService $service): JsonResponse
    {
        return $this->json(['data' => $service->action($request->user(), $plan, $action, $request->validated(), (string) $request->header('Idempotency-Key'))]);
    }

    public function versions(Request $request, SortingPlan $plan, SortingVersionService $service): JsonResponse
    {
        $owned = $service->owned($request->user(), $plan->id);

        return $this->json(['data' => $owned->versions()->get()->toArray()]);
    }

    public function version(Request $request, SortingPlan $plan, string $version, SortingVersionService $service): JsonResponse
    {
        $owned = $service->owned($request->user(), $plan->id);

        return $this->json(['data' => $owned->versions()->whereKey($version)->firstOrFail()->toArray()]);
    }

    public function destroy(RemoveSortingPlanLaneRequest $request, SortingPlan $plan, SortingPlanService $service): JsonResponse
    {
        $service->deletePlan($request->user(), $plan, (int) $request->validated('expected_revision'));

        return $this->json(['data' => null]);
    }

    public function index(Request $request, SortingPlanService $service): JsonResponse
    {
        return $this->json(['data' => $service->overview($request->user())]);
    }

    public function store(CreateSortingPlanRequest $request, SortingPlanService $service): JsonResponse
    {
        return $this->json(['data' => $service->planProjection($service->createPlan($request->user(), $request->validated()))], 201);
    }

    public function update(UpdateSortingPlanRequest $request, SortingPlan $plan, SortingPlanService $service): JsonResponse
    {
        return $this->json(['data' => $service->planProjection($service->updatePlan($request->user(), $plan, $request->validated()))]);
    }

    public function storeLane(AddSortingPlanLaneRequest $request, SortingPlan $plan, SortingPlanService $service): JsonResponse
    {
        return $this->json(['data' => $service->planProjection($service->addLane($request->user(), $plan, $request->validated()))]);
    }

    public function destroyLane(RemoveSortingPlanLaneRequest $request, SortingPlan $plan, SortingPlanLane $planLane, SortingPlanService $service): JsonResponse
    {
        return $this->json(['data' => $service->planProjection($service->removeLane($request->user(), $plan, $planLane, (int) $request->validated('expected_revision')))]);
    }

    private function json(array $payload, int $status = 200): JsonResponse
    {
        return response()->json($payload, $status)->header('Cache-Control', 'private, no-store');
    }
}
