<?php

namespace App\Http\Controllers\Logistics;

use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\FleetAssignmentRequest;
use App\Services\Logistics\FleetAssignmentService;
use Illuminate\Http\JsonResponse;

class FleetAssignmentController extends Controller
{
    public function index(FleetAssignmentRequest $request, FleetAssignmentService $service): JsonResponse
    {
        $at = now();
        $page = $service->listing($request->user(), $request->validated());

        return response()->json(['data' => $page->items(), 'meta' => [
            'current_page' => $page->currentPage(), 'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(), 'total' => $page->total(), 'server_time' => $at->toISOString(),
        ]])->header('Cache-Control', 'private, no-store');
    }
}
