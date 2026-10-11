<?php

namespace App\Http\Controllers\Courier;

use App\Http\Controllers\Controller;
use App\Http\Requests\Courier\DashboardRequest;
use App\Services\Courier\CourierDashboardService;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function show(DashboardRequest $request, CourierDashboardService $dashboard): JsonResponse
    {
        if ((int) $request->query('version', 1) === 2) {
            return response()->json($dashboard->snapshot($request->user()))
                ->header('Cache-Control', 'private, no-store');
        }
        $generatedAt = now()->toIso8601String();
        $unavailable = [
            'state' => 'unavailable',
            'reason' => 'OPERATIONAL_SCHEMA_DEFERRED',
        ];

        return response()->json([
            'data' => [],
            'meta' => [
                'next_cursor' => null,
                'generated_at' => $generatedAt,
            ],
            'sections' => [
                'notifications' => $unavailable,
                'available_tasks' => $unavailable,
                'active_tasks' => $unavailable,
            ],
            'freshness' => [
                'state' => 'scaffold',
                'reason' => 'OPERATIONAL_SCHEMA_DEFERRED',
                'generated_at' => $generatedAt,
            ],
        ])->header('Cache-Control', 'private, no-store');
    }
}
