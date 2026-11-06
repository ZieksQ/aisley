<?php

namespace App\Http\Controllers\Onboarding;

use App\Http\Controllers\Controller;
use App\Services\Onboarding\DashboardSetupGuide;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SetupGuideController extends Controller
{
    public function __invoke(Request $request, DashboardSetupGuide $guide): JsonResponse
    {
        return response()->json($guide->forUser($request->user()))
            ->header('Cache-Control', 'private, no-store')->header('Pragma', 'no-cache');
    }
}
