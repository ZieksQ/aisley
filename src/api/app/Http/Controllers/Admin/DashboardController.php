<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\Admin\DashboardResource;
use App\Services\Admin\DashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function show(Request $request, DashboardService $dashboard): JsonResponse
    {
        return (new DashboardResource($dashboard->overview($request->user())))
            ->response()->header('Cache-Control', 'private, no-store');
    }
}
