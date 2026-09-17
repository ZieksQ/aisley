<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\HubRoutingConfigurationRequest;
use App\Services\Admin\HubRoutingConfigurationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HubRoutingConfigurationController extends Controller
{
    public function index(Request $request, string $kind, HubRoutingConfigurationService $service): JsonResponse
    {
        $request->validate(['per_page' => ['sometimes', 'integer', 'min:1', 'max:100'], 'page' => ['sometimes', 'integer', 'min:1']]);
        $model = $service->model($kind);

        return response()->json($model::query()->orderBy('id')->paginate((int) $request->input('per_page', 25)))->header('Cache-Control', 'private, no-store');
    }

    public function store(HubRoutingConfigurationRequest $request, string $kind, HubRoutingConfigurationService $service): JsonResponse
    {
        return $this->write($request, $kind, $service, null);
    }

    public function update(HubRoutingConfigurationRequest $request, string $kind, string $id, HubRoutingConfigurationService $service): JsonResponse
    {
        return $this->write($request, $kind, $service, $id);
    }

    private function write(HubRoutingConfigurationRequest $request, string $kind, HubRoutingConfigurationService $service, ?string $id): JsonResponse
    {
        $record = $service->write($request->user(), $kind, $request->validated(), $id, ['ip_address' => $request->ip(), 'user_agent' => $request->userAgent(), 'request_id' => $request->header('X-Request-ID')]);

        return response()->json(['data' => $record], $id === null ? 201 : 200)->header('Cache-Control', 'private, no-store');
    }
}
