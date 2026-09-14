<?php

namespace App\Http\Controllers\Logistics;

use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\CreateDispatchScheduleRequest;
use App\Services\Logistics\DispatchScheduleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DispatchScheduleController extends Controller
{
    public function index(Request $request, DispatchScheduleService $service): JsonResponse
    {
        return response()->json(['data' => $service->schedules($request->user())])->header('Cache-Control', 'private, no-store');
    }

    public function couriers(Request $request, DispatchScheduleService $service): JsonResponse
    {
        return response()->json(['data' => $service->couriers($request->user())])->header('Cache-Control', 'private, no-store');
    }

    public function store(CreateDispatchScheduleRequest $request, DispatchScheduleService $service): JsonResponse
    {
        $schedule = $service->create($request->user(), $request->validated(), $request->idempotencyKey());

        return response()->json(['data' => $service->projection($schedule)], 201)->header('Cache-Control', 'private, no-store');
    }
}
