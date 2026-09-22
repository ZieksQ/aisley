<?php

namespace App\Http\Controllers\Courier;

use App\Http\Controllers\Controller;
use App\Services\Logistics\LinehaulTripService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LinehaulTripController extends Controller
{
    public function index(Request $request, LinehaulTripService $service): JsonResponse
    {
        return response()->json(['data' => $service->courierTrips($request->user())])->header('Cache-Control', 'private, no-store');
    }
}
