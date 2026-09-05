<?php

namespace App\Http\Controllers\Logistics;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $hub = $user->logisticsOrganization()->with('hub.address')->firstOrFail()->hub;

        return response()->json(['hub' => ['id' => $hub->id, 'name' => $hub->name, 'address' => ['barangay' => $hub->address->barangay, 'city_municipality' => $hub->address->city_municipality, 'province' => $hub->address->province, 'region' => $hub->address->region]], 'summary' => null, 'orders' => [], 'freshness' => ['generated_at' => now()->toIso8601String(), 'state' => 'scaffold']])->header('Cache-Control', 'private, no-store');
    }
}
