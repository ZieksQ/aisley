<?php

namespace App\Http\Controllers\Logistics;

use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\ReleaseSortingExceptionRequest;
use App\Services\Logistics\Sorting\SortingExceptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SortingExceptionController extends Controller
{
    public function index(Request $request, SortingExceptionService $service): JsonResponse
    {
        return response()->json($service->queue($request->user(), max(1, min(100000, $request->integer('page', 1)))))->header('Cache-Control', 'private, no-store');
    }

    public function release(ReleaseSortingExceptionRequest $request, string $exception, SortingExceptionService $service): JsonResponse
    {
        return response()->json(['data' => $service->release($request->user(), $exception, $request->validated(), $request->idempotencyKey())])->header('Cache-Control', 'private, no-store');
    }
}
