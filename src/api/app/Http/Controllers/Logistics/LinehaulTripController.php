<?php

namespace App\Http\Controllers\Logistics;

use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\ScheduleLinehaulReturnRequest;
use App\Http\Requests\Logistics\ScheduleLinehaulTripRequest;
use App\Services\Logistics\LinehaulTripService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LinehaulTripController extends Controller
{
    public function index(Request $request, LinehaulTripService $service): JsonResponse
    {
        return response()->json(['data' => $service->overview($request->user())])->header('Cache-Control', 'private, no-store');
    }

    public function store(ScheduleLinehaulTripRequest $request, LinehaulTripService $service): JsonResponse
    {
        return response()->json(['data' => $service->scheduleOutbound($request->user(), $request->validated(), $request->idempotencyKey())], 201)->header('Cache-Control', 'private, no-store');
    }

    public function decide(Request $request, string $trip, LinehaulTripService $service): JsonResponse
    {
        $input = $request->validate(['accept' => ['required', 'boolean'], 'reason' => ['nullable', 'string', 'max:500', 'required_if:accept,false'], 'expected_revision' => ['required', 'integer', 'min:1']]);

        return response()->json(['data' => $service->decide($request->user(), $trip, $input['accept'], $input['reason'] ?? null, $input['expected_revision'])])->header('Cache-Control', 'private, no-store');
    }

    public function cancel(Request $request, string $trip, LinehaulTripService $service): JsonResponse
    {
        $input = $request->validate(['expected_revision' => ['required', 'integer', 'min:1']]);

        return response()->json(['data' => $service->cancel($request->user(), $trip, $input['expected_revision'])])->header('Cache-Control', 'private, no-store');
    }

    public function depart(Request $request, string $trip, LinehaulTripService $service): JsonResponse
    {
        $input = $request->validate(['expected_revision' => ['required', 'integer', 'min:1']]);

        return response()->json(['data' => $service->depart($request->user(), $trip, $input['expected_revision'])])->header('Cache-Control', 'private, no-store');
    }

    public function receive(Request $request, string $trip, LinehaulTripService $service): JsonResponse
    {
        $input = $request->validate(['expected_revision' => ['required', 'integer', 'min:1']]);

        return response()->json(['data' => $service->receive($request->user(), $trip, $input['expected_revision'])])->header('Cache-Control', 'private, no-store');
    }

    public function scheduleReturn(ScheduleLinehaulReturnRequest $request, string $trip, LinehaulTripService $service): JsonResponse
    {
        return response()->json(['data' => $service->scheduleReturn($request->user(), $trip, $request->validated(), $request->idempotencyKey())], 201)->header('Cache-Control', 'private, no-store');
    }
}
