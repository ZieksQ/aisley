<?php

namespace App\Http\Controllers\Logistics;

use App\Http\Controllers\Controller;
use App\Http\Requests\Logistics\StoreCompanyTruckRequest;
use App\Http\Requests\Logistics\UpdateCompanyTruckRequest;
use App\Services\Logistics\CompanyFleetService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CompanyFleetController extends Controller
{
    public function index(Request $request, CompanyFleetService $service): JsonResponse
    {
        return response()->json(['data' => ['trucks' => $service->trucks($request->user()), 'drivers' => $service->drivers($request->user())]])->header('Cache-Control', 'private, no-store');
    }

    public function store(StoreCompanyTruckRequest $request, CompanyFleetService $service): JsonResponse
    {
        return response()->json(['data' => $service->create($request->user(), $request->validated())], 201)->header('Cache-Control', 'private, no-store');
    }

    public function update(UpdateCompanyTruckRequest $request, string $truck, CompanyFleetService $service): JsonResponse
    {
        return response()->json(['data' => $service->update($request->user(), $truck, $request->validated())])->header('Cache-Control', 'private, no-store');
    }

    public function driver(Request $request, string $courier, CompanyFleetService $service): JsonResponse
    {
        $input = $request->validate(['can_drive_company_truck' => ['required', 'boolean'], 'expected_revision' => ['required', 'integer', 'min:1']]);

        return response()->json(['data' => $service->updateDriver($request->user(), $courier, $input['can_drive_company_truck'], $input['expected_revision'])])->header('Cache-Control', 'private, no-store');
    }
}
