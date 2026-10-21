<?php

namespace App\Http\Controllers\Courier;

use App\Http\Controllers\Controller;
use App\Services\Courier\LinehaulRouteService;
use App\Services\Logistics\LinehaulTripService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LinehaulTripController extends Controller
{
    public function route(Request $request, string $trip, LinehaulRouteService $service): JsonResponse
    {
        return response()->json(['data' => $service->route($request->user(), $trip)])->header('Cache-Control', 'private, no-store');
    }

    public function index(Request $request, LinehaulTripService $service): JsonResponse
    {
        return response()->json(['data' => $service->courierTrips($request->user())])->header('Cache-Control', 'private, no-store');
    }
}
